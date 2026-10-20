#include "PluginEditor.h"
namespace {
const juce::Colour bg{0xff10160f},panel{0xff1b2418},accent{0xffc9f27a},muted{0xffaab59e};
void styleSlider(juce::Slider& s,bool rotary=false){s.setSliderStyle(rotary?juce::Slider::RotaryHorizontalVerticalDrag:juce::Slider::LinearHorizontal);s.setTextBoxStyle(juce::Slider::TextBoxRight,false,48,20);s.setColour(juce::Slider::thumbColourId,accent);s.setColour(juce::Slider::trackColourId,juce::Colour{0xff536245});s.setColour(juce::Slider::textBoxTextColourId,juce::Colours::white);s.setColour(juce::Slider::textBoxBackgroundColourId,panel);s.setColour(juce::Slider::textBoxOutlineColourId,juce::Colour{0xff46523d});}
}
NichodevGuitarFXAudioProcessorEditor::NichodevGuitarFXAudioProcessorEditor(NichodevGuitarFXAudioProcessor& p)
 : AudioProcessorEditor(&p),processor(p)
{
 for(auto* s:{&masterSlider,&gainSlider,&toneSlider})styleSlider(*s,true);
 addAndMakeVisible(masterSlider);addAndMakeVisible(gainSlider);addAndMakeVisible(toneSlider);
 masterAttachment=std::make_unique<SliderAttachment>(processor.parameters,"master",masterSlider);
 gainAttachment=std::make_unique<SliderAttachment>(processor.parameters,"ampGain",gainSlider);
 toneAttachment=std::make_unique<SliderAttachment>(processor.parameters,"ampTone",toneSlider);
 presets.addItem("Selecionar preset",1);presets.addItem("CLEAN PIXEL",2);presets.addItem("8-BIT BLUES",3);presets.addItem("ARCADE CRUNCH",4);presets.addItem("BOSS BATTLE",5);presets.addItem("SPACE DELAY",6);
 addAndMakeVisible(presets);addAndMakeVisible(randomButton);addAndMakeVisible(resetButton);
 presets.onChange=[this]{switch(presets.getSelectedId()){case 2:processor.applyPreset("clean");break;case 3:processor.applyPreset("blues");break;case 4:processor.applyPreset("crunch");break;case 5:processor.applyPreset("fuzz");break;case 6:processor.applyPreset("space");break;default:break;}};
 randomButton.onClick=[this]{processor.randomizeGuitar();};resetButton.onClick=[this]{processor.resetGuitar();presets.setSelectedId(1,juce::dontSendNotification);};
 for(int i=0;i<NichodevGuitarFXAudioProcessor::pedalCount;++i){
  auto& b=pedalButtons[(size_t)i];auto& s=pedalSliders[(size_t)i];styleSlider(s);
  b.setButtonText(NichodevGuitarFXAudioProcessor::names[(size_t)i]);b.setClickingTogglesState(true);
  addAndMakeVisible(b);addAndMakeVisible(s);addAndMakeVisible(upButtons[(size_t)i]);addAndMakeVisible(downButtons[(size_t)i]);
  upButtons[(size_t)i].setButtonText("↑");downButtons[(size_t)i].setButtonText("↓");
  upButtons[(size_t)i].onClick=[this,i]{processor.movePedal(i,-1);};
  downButtons[(size_t)i].onClick=[this,i]{processor.movePedal(i,1);};
  auto id=juce::String(NichodevGuitarFXAudioProcessor::ids[(size_t)i]);
  sliderAttachments[(size_t)i]=std::make_unique<SliderAttachment>(processor.parameters,id,s);
  buttonAttachments[(size_t)i]=std::make_unique<ButtonAttachment>(processor.parameters,id+"On",b);
 }
 setResizable(true,true);setResizeLimits(700,650,1080,1000);setSize(820,800);
}
void NichodevGuitarFXAudioProcessorEditor::paint(juce::Graphics& g)
{
 g.fillAll(bg);g.setColour(panel);g.fillRoundedRectangle(getLocalBounds().toFloat().reduced(10),12);
 g.setColour(accent);g.setFont(juce::FontOptions(21,juce::Font::bold));g.drawText("NICHODEV / GUITAR FX LAB",24,14,getWidth()-48,30,juce::Justification::centredLeft);
 g.setColour(muted);g.setFont(juce::FontOptions(11));g.drawText("PEDALEIRA COMPLETA  •  ORDEM DE SINAL DE CIMA PARA BAIXO",24,43,getWidth()-48,20,juce::Justification::centredLeft);
 for(int i=0;i<3;++i){const juce::String label=i==0?"MASTER":i==1?"AMP GAIN":"AMP TONE";g.setColour(accent);g.setFont(juce::FontOptions(11,juce::Font::bold));g.drawText(label,24+i*150,76,138,18,juce::Justification::centred);}
 g.setColour(muted);g.drawText("↑ ↓ altera a ordem dos pedais. OFF mantém os ajustes.",24,getHeight()-26,getWidth()-48,16,juce::Justification::centredLeft);
}
void NichodevGuitarFXAudioProcessorEditor::resized()
{
 auto w=getWidth();masterSlider.setBounds(25,95,130,75);gainSlider.setBounds(175,95,130,75);toneSlider.setBounds(325,95,130,75);
 presets.setBounds(485,97,155,30);randomButton.setBounds(650,97,78,30);resetButton.setBounds(735,97,72,30);
 const int top=190,rowH=34,gap=10,colW=(w-58)/2;
 for(int i=0;i<NichodevGuitarFXAudioProcessor::pedalCount;++i){
  const int col=i<8?0:1,row=i<8?i:i-8,x=24+col*(colW+10),y=top+row*rowH;
  pedalButtons[(size_t)i].setBounds(x,y,94,28);pedalSliders[(size_t)i].setBounds(x+100,y,colW-159,28);
  upButtons[(size_t)i].setBounds(x+colW-51,y,24,28);downButtons[(size_t)i].setBounds(x+colW-25,y,24,28);
 }
}