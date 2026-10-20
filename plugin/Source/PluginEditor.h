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
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;

    NichodevGuitarFXAudioProcessor& processor;
    juce::Slider driveSlider;
    juce::Slider toneSlider;
    juce::Slider mixSlider;
    juce::Slider outputSlider;
    std::unique_ptr<SliderAttachment> driveAttachment;
    std::unique_ptr<SliderAttachment> toneAttachment;
    std::unique_ptr<SliderAttachment> mixAttachment;
    std::unique_ptr<SliderAttachment> outputAttachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(NichodevGuitarFXAudioProcessorEditor)
};
