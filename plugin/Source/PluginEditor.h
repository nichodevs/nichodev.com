#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

class NichodevGuitarFXAudioProcessorEditor final : public juce::AudioProcessorEditor
{
public:
    explicit NichodevGuitarFXAudioProcessorEditor(NichodevGuitarFXAudioProcessor&);
    ~NichodevGuitarFXAudioProcessorEditor() override = default;
    void paint(juce::Graphics&) override;
    void resized() override;
private:
    using SliderAttachment=juce::AudioProcessorValueTreeState::SliderAttachment;
    using ButtonAttachment=juce::AudioProcessorValueTreeState::ButtonAttachment;
    NichodevGuitarFXAudioProcessor& processor;
    juce::Slider masterSlider,gainSlider,toneSlider;
    std::unique_ptr<SliderAttachment> masterAttachment,gainAttachment,toneAttachment;
    juce::ComboBox presets;
    juce::TextButton randomButton{"RANDOM"},resetButton{"RESETAR"};
    std::array<juce::Slider,NichodevGuitarFXAudioProcessor::pedalCount> pedalSliders;
    std::array<juce::ToggleButton,NichodevGuitarFXAudioProcessor::pedalCount> pedalButtons;
    std::array<juce::TextButton,NichodevGuitarFXAudioProcessor::pedalCount> upButtons,downButtons;
    std::array<std::unique_ptr<SliderAttachment>,NichodevGuitarFXAudioProcessor::pedalCount> sliderAttachments;
    std::array<std::unique_ptr<ButtonAttachment>,NichodevGuitarFXAudioProcessor::pedalCount> buttonAttachments;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(NichodevGuitarFXAudioProcessorEditor)
};