#include "TunerEditor.h"
#include "BinaryData.h"

namespace
{
const juce::Colour background{0xff10160f}, panel{0xff1b2418}, foreground{0xffeaf2dc};
const juce::Colour muted{0xffa8b49a}, line{0xff64734d}, lime{0xffc9f27a};

juce::Font pixelFont(float height)
{
    static const auto face = juce::Typeface::createSystemTypefaceFor(
        BinaryData::Pixel_ttf, static_cast<std::size_t>(BinaryData::Pixel_ttfSize));
    return juce::Font(juce::FontOptions(height).withTypeface(face));
}
}

BitunerLookAndFeel::BitunerLookAndFeel()
{
    setColour(juce::TextButton::textColourOffId, foreground);
    setColour(juce::TextButton::textColourOnId, background);
}

juce::Font BitunerLookAndFeel::getTextButtonFont(juce::TextButton&, int height)
{
    return pixelFont(juce::jlimit(10.0f, 16.0f, static_cast<float>(height) * 0.3f));
}

void BitunerLookAndFeel::drawButtonBackground(juce::Graphics& g, juce::Button& button,
                                              const juce::Colour&, bool highlighted, bool down)
{
    const auto bounds = button.getLocalBounds();
    g.setColour(button.getToggleState() || down ? lime : panel);
    g.fillRect(bounds);
    g.setColour(highlighted || button.hasKeyboardFocus(true) || button.getToggleState() ? lime : line);
    g.drawRect(bounds, 2);
}

BitunerEditor::BitunerEditor(BitunerAudioProcessor& processor)
    : AudioProcessorEditor(processor), tuner(processor)
{
    setName("8bituner");
    setDescription("Afinador cromatico de guitarra. Toque uma corda por vez.");
    setLookAndFeel(&lookAndFeel);
    setOpaque(true);
    for (auto* label : {&note, &reading, &advice, &referenceLabel})
    {
        addAndMakeVisible(*label);
        label->setJustificationType(juce::Justification::centred);
        label->setColour(juce::Label::textColourId, lime);
    }
    note.setName("Nota detectada");
    note.setComponentID("note");
    reading.setName("Frequencia e desvio em cents");
    reading.setColour(juce::Label::textColourId, muted);
    advice.setName("Orientacao de afinacao");
    advice.setComponentID("advice");
    referenceLabel.setText("A4", juce::dontSendNotification);
    referenceLabel.setColour(juce::Label::textColourId, muted);

    reference.setSliderStyle(juce::Slider::IncDecButtons);
    reference.setTextBoxStyle(juce::Slider::TextBoxLeft, false, 76, 30);
    reference.setIncDecButtonsMode(juce::Slider::incDecButtonsDraggable_AutoDirection);
    reference.setTextValueSuffix(" Hz");
    reference.setName("Referencia A4 em hertz");
    reference.setComponentID("reference");
    reference.setTooltip("Referencia do La: 430 a 450 Hz. Padrao: 440 Hz.");
    reference.setColour(juce::Slider::textBoxTextColourId, foreground);
    reference.setColour(juce::Slider::textBoxBackgroundColourId, panel);
    reference.setColour(juce::Slider::textBoxOutlineColourId, line);
    addAndMakeVisible(reference);
    mute.setClickingTogglesState(true);
    mute.setComponentID("mute");
    mute.setTooltip("Silencia somente a saida; a analise de afinacao continua ativa.");
    addAndMakeVisible(mute);
    referenceAttachment = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(
        tuner.parameters, "reference", reference);
    muteAttachment = std::make_unique<juce::AudioProcessorValueTreeState::ButtonAttachment>(
        tuner.parameters, "mute", mute);

    setResizable(true, true);
    setResizeLimits(560, 420, 840, 630);
    getConstrainer()->setFixedAspectRatio(560.0 / 420.0);
    setSize(560, 420);
    timerCallback();
    startTimerHz(30);
}

BitunerEditor::~BitunerEditor()
{
    stopTimer();
    setLookAndFeel(nullptr);
}

void BitunerEditor::resized()
{
    const auto scale = static_cast<float>(getWidth()) / 560.0f;
    const auto place = [scale](juce::Component& component, int x, int y, int w, int h)
    {
        component.setBounds(juce::Rectangle<float>(static_cast<float>(x), static_cast<float>(y),
            static_cast<float>(w), static_cast<float>(h)).scaled(scale).toNearestInt());
    };
    place(note, 20, 100, 520, 94);
    place(reading, 20, 199, 520, 28);
    place(advice, 20, 300, 520, 36);
    place(referenceLabel, 20, 373, 34, 28);
    place(reference, 61, 371, 130, 32);
    place(mute, 324, 369, 214, 36);
    note.setFont(pixelFont(64.0f * scale));
    reading.setFont(pixelFont(12.0f * scale));
    advice.setFont(pixelFont(12.0f * scale));
    referenceLabel.setFont(pixelFont(11.0f * scale));
}

void BitunerEditor::paint(juce::Graphics& g)
{
    g.fillAll(panel);
    g.addTransform(juce::AffineTransform::scale(static_cast<float>(getWidth()) / 560.0f));
    g.setColour(line);
    g.drawRect(0, 0, 560, 420, 3);
    g.fillRect(0, 51, 560, 2);
    g.setColour(background);
    g.fillRect(3, 357, 554, 60);
    g.setColour(line);
    g.fillRect(0, 355, 560, 2);
    g.setFont(pixelFont(20.0f));
    g.setColour(lime);
    g.drawText("8bituner", 20, 10, 360, 32, juce::Justification::centredLeft);
    g.setFont(pixelFont(10.0f));
    g.setColour(muted);
    g.drawText("NICHODEV / VST3", 340, 13, 198, 28, juce::Justification::centredRight);
    g.drawText("AFINADOR CROMATICO", 20, 69, 380, 22, juce::Justification::centredLeft);
    g.drawText("SINAL", 435, 69, 78, 22, juce::Justification::centredRight);
    g.setColour(displayedFrequency > 0.0f ? lime : line);
    g.fillRect(529, 76, 7, 7);

    g.setFont(pixelFont(9.0f));
    g.setColour(muted);
    for (int i = 0; i < 5; ++i)
        g.drawText(juce::String(-50 + i * 25), 20 + i * 120, 242, 40, 18, juce::Justification::centred);
    const std::array<juce::Colour, 5> colours{{juce::Colour(0xff642a31), juce::Colour(0xff82743b),
        juce::Colour(0xff24371e), juce::Colour(0xff82743b), juce::Colour(0xff642a31)}};
    const std::array<int, 6> edges{{20, 150, 254, 306, 410, 540}};
    for (std::size_t i = 0; i < colours.size(); ++i)
    {
        g.setColour(colours[i]);
        g.fillRect(edges[i], 270, edges[i + 1] - edges[i], 16);
    }
    g.setColour(foreground);
    g.fillRect(280, 266, 1, 24);
    if (displayedFrequency > 0.0f)
    {
        g.setColour(lime);
        const auto needle = 20 + juce::roundToInt((juce::jlimit(-50.0, 50.0, cents) + 50.0) * 5.2);
        g.fillRect(needle - 1, 267, 3, 22);
    }
}

void BitunerEditor::timerCallback()
{
    mute.setButtonText(tuner.isMuted() ? "SAIDA SILENCIADA" : "SILENCIAR SAIDA");
    const auto frequency = tuner.getDetectedFrequency();
    const auto a4 = tuner.getReference();
    if (frequency == displayedFrequency && a4 == displayedReference)
        return;
    displayedFrequency = frequency;
    displayedReference = a4;
    const auto pitch = bituner::describePitch(frequency, a4);
    cents = pitch.cents;
    if (pitch.midiNote < 0)
    {
        note.setText("--", juce::dontSendNotification);
        reading.setText("Aguardando sinal", juce::dontSendNotification);
        advice.setText("TOQUE UMA CORDA", juce::dontSendNotification);
    }
    else
    {
        static const std::array<const char*, 12> names{{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}};
        note.setText(juce::String(names[static_cast<std::size_t>(pitch.midiNote % 12)])
            + juce::String(pitch.midiNote / 12 - 1), juce::dontSendNotification);
        const auto roundedCents = std::round(cents * 10.0) / 10.0;
        reading.setText(juce::String(frequency, 2) + " Hz   " + (roundedCents > 0.0 ? "+" : "")
            + juce::String(roundedCents == 0.0 ? 0.0 : roundedCents, 1) + " cents", juce::dontSendNotification);
        advice.setText(std::abs(cents) <= 2.0 ? "AFINADO"
            : cents < 0.0 ? "AUMENTE A AFINACAO" : "DIMINUA A AFINACAO", juce::dontSendNotification);
    }
    repaint();
}
