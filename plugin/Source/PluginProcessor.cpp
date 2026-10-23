#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "GuitarFxDSP.h"
#include <algorithm>
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
 rate=sr;
 const auto delayLength=guitarfx::dsp::delayBufferLength(sr);
 for(int pedal=0;pedal<pedalCount;++pedal){
  for(auto& s:fx[(size_t)pedal]){
   if(guitarfx::dsp::needsDelayBuffer(pedal))s.delay.assign(delayLength,0.0f);
   else s.delay.clear();
   s.write=0;s.env=0;s.smooth=1;s.filter=0;s.phase=0;
  }
  auto& smoother=pedalValueSmoothers[(size_t)pedal];
  smoother.reset(sr,0.02);
  smoother.setCurrentAndTargetValue(pedalParams[(size_t)pedal].value->load());
  auto& enableSmoother=pedalEnableSmoothers[(size_t)pedal];
  enableSmoother.reset(sr,0.02);
  enableSmoother.setCurrentAndTargetValue(pedalParams[(size_t)pedal].on->load()>=.5f?1.0f:0.0f);
 }
 masterSmoother.reset(sr,0.02);masterSmoother.setCurrentAndTargetValue(master->load());
 gainSmoother.reset(sr,0.02);gainSmoother.setCurrentAndTargetValue(gain->load());
 toneCoefficientSmoother.reset(sr,0.02);
 const float coefficient=1-std::exp(-juce::MathConstants<float>::twoPi*(1200+10500*tone->load())/(float)rate);
 toneCoefficientSmoother.setCurrentAndTargetValue(coefficient);
 ampFilter.fill(0);ampEnv.fill(0);
}
void NichodevGuitarFXAudioProcessor::releaseResources(){for(auto& p:fx)for(auto& s:p){std::fill(s.delay.begin(),s.delay.end(),0);s.write=0;}}
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
 const float dcBlockCoefficient=1-std::exp(-juce::MathConstants<float>::twoPi*20.0f/(float)rate);
 for(int n=0;n<b.getNumSamples();++n){const float mg=masterSmoother.getNextValue(),g=gainSmoother.getNextValue(),toneA=toneCoefficientSmoother.getNextValue();std::array<float,pedalCount> amounts{},enabled{};for(int i=0;i<pedalCount;++i){amounts[(size_t)i]=pedalValueSmoothers[(size_t)i].getNextValue();enabled[(size_t)i]=pedalEnableSmoothers[(size_t)i].getNextValue();}
  for(int c=0;c<b.getNumChannels();++c){
  float x=b.getSample(c,n);
  for(int k=0;k<pedalCount;++k){int i=blockOrder[(size_t)k];float a=amounts[(size_t)i],enable=enabled[(size_t)i];if(enable<=0.0f&&!pedalEnableSmoothers[(size_t)i].isSmoothing())continue;
   auto& s=fx[(size_t)i][(size_t)std::min(c,1)];float dry=x,in=x;
   auto read=[&](float sec){int len=(int)s.delay.size();float p=(float)s.write-sec*(float)rate;while(p<0)p+=len;int q=(int)p;float f=p-q;return s.delay[(size_t)q]*(1-f)+s.delay[(size_t)((q+1)%len)]*f;};
   auto write=[&](float v){s.delay[(size_t)s.write]=v;s.write=(s.write+1)%(int)s.delay.size();};
   switch(i){
    case 0:{s.env+=(std::abs(in)>s.env?.04f:.002f)*(std::abs(in)-s.env);float target=s.env<(.012f+.11f*a)?.08f:1;s.smooth+=.004f*(target-s.smooth);x=in*s.smooth;break;}
    case 1:{s.env+=(std::abs(in)>s.env?.03f:.003f)*(std::abs(in)-s.env);float th=.30f-.22f*a;float target=s.env>th?std::pow(th/std::max(s.env,.0001f),1-1/(1+6*a)):1;s.smooth+=.01f*(target-s.smooth);x=in*s.smooth;break;}
    case 2:x=std::tanh(in*(1+18*a)*.75f);break;
    case 3:x=(1+25*a)*in/(1+(1+25*a)*std::abs(in));break;
    case 4:s.filter+=.025f*(in-s.filter);x=in+(a-.5f)*(in-s.filter)*1.6f;break;
    case 5:case 6:{s.phase+=juce::MathConstants<float>::twoPi*(i==5?.7f+.8f*a:.15f+1.1f*a)/(float)rate;if(s.phase>6.28318f)s.phase-=6.28318f;float wet=read((i==5?.022f:.004f)+(i==5?.008f:.0035f)*a*(.5f+.5f*std::sin(s.phase)));write(in);float mix=.25f+.45f*a;x=in*(1-mix)+wet*mix;break;}
    case 7:s.phase+=juce::MathConstants<float>::twoPi*(.15f+1.4f*a)/(float)rate;s.filter+=(.015f+.02f*std::sin(s.phase))*(in-s.filter);x=.4f*in+.6f*(in-2*s.filter);break;
    case 8:x=std::tanh(in*(1+24*a)*1.8f);break;
    case 9:{float octave=guitarfx::dsp::removeRectifierDc(in,s.filter,dcBlockCoefficient);x=std::tanh(octave*(1+20*a)*1.8f);break;}
    case 10:s.phase+=juce::MathConstants<float>::twoPi*(.8f+5*a)/(float)rate;x=read(.012f+(.0006f+.006f*a)*std::sin(s.phase));write(in);break;
    case 11:s.phase+=juce::MathConstants<float>::twoPi*(2+8*a)/(float)rate;x=in*(1-.48f*a+.48f*a*(.5f+.5f*std::sin(s.phase)));break;
    case 12:{float w=read(.09f+.32f*a);write(in+w*std::min(.42f,.48f*a));float m=.08f+.3f*a;x=in*(1-m)+w*m;break;}
    case 13:{float w=read(.17f+.38f*a);write(in+w*(.25f+.55f*a));float m=.04f+.34f*a;x=in*(1-m)+w*m;break;}
    case 14:{float w=read(.36f+.35f*a);float octave=guitarfx::dsp::removeRectifierDc(in,s.filter,dcBlockCoefficient);write(octave*.7f+w*.55f);x=in*.82f+w*(.16f+.68f*a);break;}
   }
   x=guitarfx::dsp::mixEffect(dry,x,enable);
  }
  x=std::tanh(x*(1+g*1.5f)*(1+g*7));
  const auto channel=(size_t)std::min(c,1);ampFilter[channel]+=toneA*(x-ampFilter[channel]);ampEnv[channel]+=.009f*(x-ampEnv[channel]);
  x=ampFilter[channel]+(x-ampEnv[channel])*.22f;b.setSample(c,n,x*mg);
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
 struct P{const char* id;float v[15];bool on[15];float gain,tone;};
 static const P ps[]={
 {"clean",{.30f,.18f,0,0,.54f,0,0,0,0,0,0,0,0,0,0},{1,1,0,0,1,0,0,0,0,0,0,0,0,0,0},.12f,.58f},
 {"blues",{.28f,.38f,.36f,0,.58f,.10f,0,0,0,0,0,0,.12f,.14f,0},{1,1,1,0,1,1,0,0,0,0,0,0,1,1,0},.30f,.62f},
 {"crunch",{.35f,.26f,.28f,.46f,.60f,0,0,0,0,0,0,0,.08f,.15f,0},{1,1,1,1,1,0,0,0,0,0,0,0,1,1,0},.58f,.58f},
 {"fuzz",{.46f,.40f,0,.78f,.42f,0,0,0,0,0,0,0,.12f,.10f,0},{1,1,0,1,1,0,0,0,0,0,0,0,1,1,0},.58f,.58f},
 // Ambient preset: keep the input gate off to preserve soft notes and long tails.
 {"space",{.20f,.20f,0,0,.52f,.38f,.22f,.35f,0,0,0,.15f,.62f,.58f,0},{0,1,0,0,1,1,1,1,0,0,0,1,1,1,0},.12f,.58f}};
 for(auto& p:ps)if(name==p.id){for(int i=0;i<pedalCount;++i){auto* v=parameters.getParameter(ids[(size_t)i]);v->setValueNotifyingHost(v->convertTo0to1(p.v[i]));auto* on=parameters.getParameter(juce::String(ids[(size_t)i])+"On");on->setValueNotifyingHost(on->convertTo0to1(p.on[i]?1.f:0.f));}auto* a=parameters.getParameter(gainId);a->setValueNotifyingHost(a->convertTo0to1(p.gain));auto* t=parameters.getParameter(toneId);t->setValueNotifyingHost(t->convertTo0to1(p.tone));}
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
