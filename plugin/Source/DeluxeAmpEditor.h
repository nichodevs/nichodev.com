#pragma once

#include <JuceHeader.h>
#include "DeluxeAmpProcessor.h"

class Deluxe65LookAndFeel final : public juce::LookAndFeel_V4
{
public:
    Deluxe65LookAndFeel();
    juce::Font getTextButtonFont(juce::TextButton&, int buttonHeight) override;
    juce::Font getToggleButtonFont(juce::ToggleButton&, int buttonHeight);
    juce::Font getLabelFont(juce::Label&) override;
    juce::Font getComboBoxFont(juce::ComboBox&) override;
    void drawButtonBackground(juce::Graphics&, juce::Button&, const juce::Colour&,
                              bool, bool) override;
    void drawButtonText(juce::Graphics&, juce::TextButton&, bool, bool) override;
    void drawToggleButton(juce::Graphics&, juce::ToggleButton&, bool, bool) override;
    void drawLinearSlider(juce::Graphics&, int, int, int, int, float, float, float,
                          juce::Slider::SliderStyle, juce::Slider&) override;
};

class Deluxe65AudioProcessorEditor final : public juce::AudioProcessorEditor,
                                           private juce::Timer
{
public:
    explicit Deluxe65AudioProcessorEditor(Deluxe65AudioProcessor& processor);
    ~Deluxe65AudioProcessorEditor() override;
    void paint(juce::Graphics&) override;
    void resized() override;

private:
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ButtonAttachment = juce::AudioProcessorValueTreeState::ButtonAttachment;

    void selectChannel(int channel);
    void selectInput(int input);
    void refreshSelectorButtons();
    void timerCallback() override;

    Deluxe65LookAndFeel retroLookAndFeel;
    Deluxe65AudioProcessor& processor;
    std::array<juce::TextButton, 2> channelButtons;
    std::array<juce::TextButton, 2> inputButtons;
    std::array<juce::Slider, 9> controls;
    std::array<juce::Label, 9> controlLabels;
    juce::ToggleButton brightButton{"BRIGHT"};
    juce::ToggleButton vibratoButton{"PITCH VIBRATO"};
    std::array<std::unique_ptr<SliderAttachment>, 9> sliderAttachments;
    std::unique_ptr<ButtonAttachment> brightAttachment;
    std::unique_ptr<ButtonAttachment> vibratoAttachment;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(Deluxe65AudioProcessorEditor)
};
