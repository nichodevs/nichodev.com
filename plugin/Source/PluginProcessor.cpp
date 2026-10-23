#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "GuitarFxDSP.h"
#include <cmath>

const std::array<const char*,15> NichodevGuitarFXAudioProcessor::ids={"ns2","cs3","bd2","ds1","ge7","ch1","bf3","ph3","fuzz","octfuzz","vibrato","tr2","dd8","rv6","shimmer"};
const std::array<const char*,15> NichodevGuitarFXAudioProcessor::names={"NS-2","CS-3","BD-2","DS-1","GE-7 TILT","CH-1","BF-3","PH-3","FZ-5","OCTAFUZZ","VB-2","TR-2","DD-8","RV-6","SHIMMER"};
const std::array<const char*,15> NichodevGuitarFXAudioProcessor::controls={"Threshold","Sustain","Drive","Dist","Tone","Depth","Depth","Rate","Fuzz","Octave","Depth","Depth","Feedback","Level","Shimmer"};
namespace { constexpr auto masterId="master", gainId="ampGain", toneId="ampTone"; }
NichodevGuitarFXAudioProcessor::NichodevGuitarFXAudioProcessor()
 : AudioProcessor(BusesProperties().withInput("Input",juce::AudioChannelSet::stereo(),true).withOutput("Output",juce::AudioChannelSet::stereo(),true)),
   parameters(*this,nullptr,"PARAMETERS",createParameterLayout())
{
 master=parameters.getRawParameterValue(masterId); gain=parameters.getRawParameterValue(gainId); tone=parameters.getRawParameterValue(toneId);
 for(int i=0;i<pedalCount;++i){auto id=juce::String(ids[(size_t)i]);pedalParams[(size_t)i]={parameters.getRawParameterValue(id),parameters.getRawParameterValue(id+"On")};order[(size_t)i]=i;lastAudioOrder[(size_t)i]=i;}
}
juce::AudioProcessorValueTreeState::ParameterLayout NichodevGuitarFXAudioProcessor::createParameterLayout()
{
 juce::AudioProcessorValueTreeState::ParameterLayout l;
 l.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{masterId,1},"Master",juce::NormalisableRange<float>{0,1,.001f},.55f));
 l.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{gainId,1},"Amp Gain",juce::NormalisableRange<float>{0,1,.001f},.12f));
 l.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{toneId,1},"Amp Tone",juce::NormalisableRange<float>{0,1,.001f},.58f));
 for(int i=0;i<pedalCount;++i){juce::String id=ids[(size_t)i];float v=i==0?.35f:i==1?.18f:i==4?.5f:0.0f;bool on=i==0||i==1||i==4;
  l.add(std::make_unique<juce::AudioParameterFloat>(juce::ParameterID{id,1},names[(size_t)i],juce::NormalisableRange<float>{0,1,.001f},v));
  l.add(std::make_unique<juce::AudioParameterBool>(juce::ParameterID{id+"On",1},id+" On",on));}
 return l;
}
void NichodevGuitarFXAudioProcessor::prepareToPlay(double sr,int)
{
 rate=std::isfinite(sr)&&sr>0.0?sr:44100.0;
 dspEngine.prepare(rate);
 for(int pedal=0;pedal<pedalCount;++pedal){
  auto& smoother=pedalValueSmoothers[(size_t)pedal];
  smoother.reset(rate,0.02);
  smoother.setCurrentAndTargetValue(pedalParams[(size_t)pedal].value->load());
  auto& enableSmoother=pedalEnableSmoothers[(size_t)pedal];
  enableSmoother.reset(rate,0.02);
  enableSmoother.setCurrentAndTargetValue(pedalParams[(size_t)pedal].on->load()>=.5f?1.0f:0.0f);
 }
 masterSmoother.reset(rate,0.02);masterSmoother.setCurrentAndTargetValue(master->load());
 gainSmoother.reset(rate,0.02);gainSmoother.setCurrentAndTargetValue(gain->load());
 toneCoefficientSmoother.reset(rate,0.02);
 const float coefficient=1-std::exp(-juce::MathConstants<float>::twoPi*(1200+10500*tone->load())/(float)rate);
 toneCoefficientSmoother.setCurrentAndTargetValue(coefficient);
}
void NichodevGuitarFXAudioProcessor::releaseResources(){dspEngine.release();}
bool NichodevGuitarFXAudioProcessor::isBusesLayoutSupported(const BusesLayout& l)const{auto o=l.getMainOutputChannelSet();return o==l.getMainInputChannelSet()&&(o==juce::AudioChannelSet::mono()||o==juce::AudioChannelSet::stereo());}
void NichodevGuitarFXAudioProcessor::processBlock(juce::AudioBuffer<float>& b,juce::MidiBuffer& midi)
{
 juce::ScopedNoDenormals guard;midi.clear();
 masterSmoother.setTargetValue(master->load());gainSmoother.setTargetValue(gain->load());
 const float toneTarget=tone->load();
 toneCoefficientSmoother.setTargetValue(1-std::exp(-juce::MathConstants<float>::twoPi*(1200+10500*toneTarget)/(float)rate));
 for(int i=0;i<pedalCount;++i){pedalValueSmoothers[(size_t)i].setTargetValue(pedalParams[(size_t)i].value->load());pedalEnableSmoothers[(size_t)i].setTargetValue(pedalParams[(size_t)i].on->load()>=.5f?1.0f:0.0f);}
 auto blockOrder=lastAudioOrder;const auto revisionBefore=orderRevision.load(std::memory_order_acquire);
 if((revisionBefore&1u)==0){std::array<int,pedalCount> candidate{};for(int i=0;i<pedalCount;++i)candidate[(size_t)i]=order[(size_t)i].load(std::memory_order_relaxed);const auto revisionAfter=orderRevision.load(std::memory_order_acquire);if(revisionBefore==revisionAfter){blockOrder=candidate;lastAudioOrder=candidate;}}
 for(int n=0;n<b.getNumSamples();++n){const float mg=masterSmoother.getNextValue(),g=gainSmoother.getNextValue(),toneA=toneCoefficientSmoother.getNextValue();std::array<float,pedalCount> amounts{},enabled{};for(int i=0;i<pedalCount;++i){amounts[(size_t)i]=pedalValueSmoothers[(size_t)i].getNextValue();enabled[(size_t)i]=pedalEnableSmoothers[(size_t)i].getNextValue();}
  for(int c=0;c<b.getNumChannels();++c){
   const auto output=dspEngine.processSample(b.getSample(c,n),c,amounts,enabled,blockOrder,mg,g,toneA);
   b.setSample(c,n,output);
  }
 }
}
int NichodevGuitarFXAudioProcessor::getPedalAtPosition(int position) const
{
 if(position<0||position>=pedalCount)return -1;
 for(;;){const auto before=orderRevision.load(std::memory_order_acquire);if(before&1u)continue;const int pedal=order[(size_t)position].load(std::memory_order_relaxed);if(before==orderRevision.load(std::memory_order_acquire))return pedal;}
}
void NichodevGuitarFXAudioProcessor::movePedal(int pedalId,int delta)
{
 std::array<int,pedalCount> updatedOrder{};
 {
  const std::lock_guard<std::mutex> lock(orderWriteMutex);
  for(int i=0;i<pedalCount;++i)updatedOrder[(size_t)i]=order[(size_t)i].load(std::memory_order_relaxed);
  if(!guitarfx::dsp::movePedal(updatedOrder,pedalId,delta))return;
  orderRevision.fetch_add(1,std::memory_order_acq_rel);
  for(int i=0;i<pedalCount;++i)order[(size_t)i].store(updatedOrder[(size_t)i],std::memory_order_relaxed);
  orderRevision.fetch_add(1,std::memory_order_release);
 }
 juce::String serialized;
 for(int i=0;i<pedalCount;++i){if(i)serialized<<",";serialized<<updatedOrder[(size_t)i];}
 parameters.state.setProperty("pedalOrder",serialized,nullptr);
}
void NichodevGuitarFXAudioProcessor::restoreOrder()
{
 auto serialized=parameters.state.getProperty("pedalOrder").toString();
 std::array<int,pedalCount> restored{};
 if(serialized.isEmpty()){for(int i=0;i<pedalCount;++i)restored[(size_t)i]=i;}
 else{
  juce::StringArray values;values.addTokens(serialized,",","");
  if(values.size()!=pedalCount)return;
  std::array<bool,pedalCount> seen{};
  for(int i=0;i<pedalCount;++i){int pedal=values[i].getIntValue();if(pedal<0||pedal>=pedalCount||seen[(size_t)pedal])return;seen[(size_t)pedal]=true;restored[(size_t)i]=pedal;}
 }
 const std::lock_guard<std::mutex> lock(orderWriteMutex);
 orderRevision.fetch_add(1,std::memory_order_acq_rel);
 for(int i=0;i<pedalCount;++i)order[(size_t)i].store(restored[(size_t)i],std::memory_order_relaxed);
 orderRevision.fetch_add(1,std::memory_order_release);
}
void NichodevGuitarFXAudioProcessor::applyPreset(const juce::String& name)
{
 const auto preset = guitarfx::dsp::findPreset(name.toStdString());
 if(preset==nullptr)return;
 for(int i=0;i<pedalCount;++i){
  auto* value=parameters.getParameter(ids[(size_t)i]);
  value->setValueNotifyingHost(value->convertTo0to1(preset->values[(size_t)i]));
  auto* enabled=parameters.getParameter(juce::String(ids[(size_t)i])+"On");
  enabled->setValueNotifyingHost(enabled->convertTo0to1(preset->enabled[(size_t)i]?1.f:0.f));
 }
 auto* ampGain=parameters.getParameter(gainId);
 ampGain->setValueNotifyingHost(ampGain->convertTo0to1(preset->gain));
 auto* ampTone=parameters.getParameter(toneId);
 ampTone->setValueNotifyingHost(ampTone->convertTo0to1(preset->tone));
}
void NichodevGuitarFXAudioProcessor::resetGuitar()
{
 for(int i=0;i<pedalCount;++i){
  auto* value=parameters.getParameter(ids[(size_t)i]);
  value->setValueNotifyingHost(value->convertTo0to1(i==0?.35f:i==1?.18f:i==4?.5f:0));
  auto* enabled=parameters.getParameter(juce::String(ids[(size_t)i])+"On");
  enabled->setValueNotifyingHost(enabled->convertTo0to1(i==0||i==1||i==4?1.f:0.f));
 }
 {
  const std::lock_guard<std::mutex> lock(orderWriteMutex);
  orderRevision.fetch_add(1,std::memory_order_acq_rel);
  for(int i=0;i<pedalCount;++i)order[(size_t)i].store(i,std::memory_order_relaxed);
  orderRevision.fetch_add(1,std::memory_order_release);
 }
 parameters.getParameter(masterId)->setValueNotifyingHost(.55f);
 parameters.getParameter(gainId)->setValueNotifyingHost(.12f);
 parameters.getParameter(toneId)->setValueNotifyingHost(.58f);
 parameters.state.removeProperty("pedalOrder",nullptr);
}
void NichodevGuitarFXAudioProcessor::randomizeGuitar(){juce::Random r;for(int i=0;i<pedalCount;++i){auto* v=parameters.getParameter(ids[(size_t)i]);v->setValueNotifyingHost(v->convertTo0to1(r.nextFloat()));auto* p=parameters.getParameter(juce::String(ids[(size_t)i])+"On");p->setValueNotifyingHost(p->convertTo0to1(r.nextFloat()>.55f?1.f:0.f));}parameters.getParameter(gainId)->setValueNotifyingHost(.1f+.65f*r.nextFloat());parameters.getParameter(toneId)->setValueNotifyingHost(.25f+.7f*r.nextFloat());}
juce::AudioProcessorEditor* NichodevGuitarFXAudioProcessor::createEditor(){return new NichodevGuitarFXAudioProcessorEditor(*this);}
void NichodevGuitarFXAudioProcessor::getStateInformation(juce::MemoryBlock& d){auto s=parameters.copyState();if(auto x=s.createXml())copyXmlToBinary(*x,d);}
void NichodevGuitarFXAudioProcessor::setStateInformation(const void* d,int n){auto x=getXmlFromBinary(d,n);if(x&&x->hasTagName(parameters.state.getType())){parameters.replaceState(juce::ValueTree::fromXml(*x));restoreOrder();}}
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter(){return new NichodevGuitarFXAudioProcessor();}
