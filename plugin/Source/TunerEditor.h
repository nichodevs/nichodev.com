#pragma once

#include "TunerProcessor.h"

class BitunerLookAndFeel final : public juce::LookAndFeel_V4
{
public:
    BitunerLookAndFeel();
    juce::Font getTextButtonFont(juce::TextButton&, int) override;
    juce::Font getLabelFont(juce::Label& label) override { return label.getFont(); }
    void drawButtonBackground(juce::Graphics&, juce::Button&, const juce::Colour&, bool, bool) override;
};

class BitunerEditor final : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit BitunerEditor(BitunerAudioProcessor&);
    ~BitunerEditor() override;
    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    BitunerLookAndFeel lookAndFeel;
    BitunerAudioProcessor& tuner;
    juce::Label note, reading, advice, referenceLabel;
    juce::Slider reference;
    juce::TextButton mute{"SILENCIAR SAIDA"};
    std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> referenceAttachment;
    std::unique_ptr<juce::AudioProcessorValueTreeState::ButtonAttachment> muteAttachment;
    float displayedFrequency = 0.0f;
    float displayedReference = 0.0f;
    double cents = 0.0;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(BitunerEditor)
};
