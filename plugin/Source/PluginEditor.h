#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

class GuitarFxRetroLookAndFeel final : public juce::LookAndFeel_V4
{
public:
    GuitarFxRetroLookAndFeel();
    void drawButtonBackground(juce::Graphics&, juce::Button&, const juce::Colour&, bool, bool) override;
    void drawButtonText(juce::Graphics&, juce::TextButton&, bool, bool) override;
    void drawToggleButton(juce::Graphics&, juce::ToggleButton&, bool, bool) override;
    void drawComboBox(juce::Graphics&, int, int, bool, int, int, int, int, juce::ComboBox&) override;
    void drawLinearSlider(juce::Graphics&, int, int, int, int, float, float, float,
                          juce::Slider::SliderStyle, juce::Slider&) override;
};

class NichodevGuitarFXAudioProcessorEditor final : public juce::AudioProcessorEditor
{
public:
    explicit NichodevGuitarFXAudioProcessorEditor(NichodevGuitarFXAudioProcessor&);
    ~NichodevGuitarFXAudioProcessorEditor() override;
    void paint(juce::Graphics&) override;
    void resized() override;
private:
    using SliderAttachment=juce::AudioProcessorValueTreeState::SliderAttachment;
    using ButtonAttachment=juce::AudioProcessorValueTreeState::ButtonAttachment;
    GuitarFxRetroLookAndFeel retroLookAndFeel;
    NichodevGuitarFXAudioProcessor& processor;
    juce::Slider masterSlider,gainSlider,toneSlider;
    std::unique_ptr<SliderAttachment> masterAttachment,gainAttachment,toneAttachment;
    juce::ComboBox presets;
    juce::TextButton randomButton{"RANDOM"},resetButton{"RESET"};
    std::array<juce::Slider,NichodevGuitarFXAudioProcessor::pedalCount> pedalSliders;
    std::array<juce::ToggleButton,NichodevGuitarFXAudioProcessor::pedalCount> pedalButtons;
    std::array<juce::TextButton,NichodevGuitarFXAudioProcessor::pedalCount> upButtons,downButtons;
    std::array<std::unique_ptr<SliderAttachment>,NichodevGuitarFXAudioProcessor::pedalCount> sliderAttachments;
    std::array<std::unique_ptr<ButtonAttachment>,NichodevGuitarFXAudioProcessor::pedalCount> buttonAttachments;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(NichodevGuitarFXAudioProcessorEditor)
};
