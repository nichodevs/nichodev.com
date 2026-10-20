#include "PluginEditor.h"

namespace
{
const juce::Colour background { 0xff10160f };
const juce::Colour panel { 0xff1b2418 };
const juce::Colour accent { 0xffc9f27a };
const juce::Colour muted { 0xffaab59e };

void configureKnob(juce::Slider& slider)
{
    slider.setSliderStyle(juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 82, 22);
    slider.setColour(juce::Slider::rotarySliderFillColourId, accent);
    slider.setColour(juce::Slider::rotarySliderOutlineColourId, juce::Colour { 0xff46523d });
    slider.setColour(juce::Slider::thumbColourId, accent);
    slider.setColour(juce::Slider::textBoxTextColourId, juce::Colours::white);
    slider.setColour(juce::Slider::textBoxBackgroundColourId, panel);
    slider.setColour(juce::Slider::textBoxOutlineColourId, juce::Colour { 0xff46523d });
}
}

NichodevGuitarFXAudioProcessorEditor::NichodevGuitarFXAudioProcessorEditor(
    NichodevGuitarFXAudioProcessor& audioProcessor)
    : AudioProcessorEditor(&audioProcessor), processor(audioProcessor)
{
    configureKnob(driveSlider);
    configureKnob(toneSlider);
    configureKnob(mixSlider);
    configureKnob(outputSlider);

    addAndMakeVisible(driveSlider);
    addAndMakeVisible(toneSlider);
    addAndMakeVisible(mixSlider);
    addAndMakeVisible(outputSlider);

    driveAttachment = std::make_unique<SliderAttachment>(processor.parameters, "drive", driveSlider);
    toneAttachment = std::make_unique<SliderAttachment>(processor.parameters, "tone", toneSlider);
    mixAttachment = std::make_unique<SliderAttachment>(processor.parameters, "mix", mixSlider);
    outputAttachment = std::make_unique<SliderAttachment>(processor.parameters, "output", outputSlider);

    setResizable(false, false);
    setSize(560, 330);
}

void NichodevGuitarFXAudioProcessorEditor::paint(juce::Graphics& graphics)
{
    graphics.fillAll(background);

    auto bounds = getLocalBounds().toFloat().reduced(14.0f);
    graphics.setColour(panel);
    graphics.fillRoundedRectangle(bounds, 12.0f);

    graphics.setColour(accent);
    graphics.setFont(juce::FontOptions(19.0f, juce::Font::bold));
    graphics.drawText("NICHODEV / GUITAR FX", 30, 22, getWidth() - 60, 28,
                      juce::Justification::centredLeft);

    graphics.setColour(muted);
    graphics.setFont(juce::FontOptions(11.0f));
    graphics.drawText("REAL-TIME GUITAR EFFECT", 30, 52, getWidth() - 60, 18,
                      juce::Justification::centredLeft);

    const auto controlWidth = (getWidth() - 80) / 4;
    const std::array<juce::String, 4> names { "DRIVE", "TONE", "MIX", "OUTPUT" };
    for (int index = 0; index < 4; ++index)
    {
        graphics.setColour(muted);
        graphics.setFont(juce::FontOptions(12.0f, juce::Font::bold));
        graphics.drawText(names[static_cast<size_t>(index)],
                          30 + index * controlWidth, 92, controlWidth, 20,
                          juce::Justification::centred);
    }

    graphics.setColour(muted);
    graphics.setFont(juce::FontOptions(10.0f));
    graphics.drawText("Nichodev.com  •  VST3", 30, getHeight() - 28,
                      getWidth() - 60, 16, juce::Justification::centredLeft);
}

void NichodevGuitarFXAudioProcessorEditor::resized()
{
    const auto controlWidth = (getWidth() - 80) / 4;
    const auto knobWidth = 104;
    const auto knobHeight = 156;
    const auto top = 116;

    std::array<juce::Slider*, 4> sliders {
        &driveSlider, &toneSlider, &mixSlider, &outputSlider
    };

    for (int index = 0; index < static_cast<int>(sliders.size()); ++index)
    {
        const auto x = 30 + index * controlWidth + (controlWidth - knobWidth) / 2;
        sliders[static_cast<size_t>(index)]->setBounds(x, top, knobWidth, knobHeight);
    }
}
