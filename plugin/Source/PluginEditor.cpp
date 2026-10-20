#include "PluginEditor.h"
#include "BinaryData.h"

namespace
{
const juce::Colour bg{0xff10160f};
const juce::Colour panel{0xff1b2418};
const juce::Colour fg{0xffeaf2dc};
const juce::Colour muted{0xffa8b49a};
const juce::Colour line{0xff64734d};
const juce::Colour lime{0xffc9f27a};
const juce::Colour orange{0xffffad55};
const juce::Colour purple{0xff2b1d38};
const juce::Colour purpleEdge{0xff8d6ca8};
const juce::Colour lavender{0xffd9b2ff};
const juce::Colour shadow{0xff050805};

juce::Typeface::Ptr pixelTypeface()
{
    static auto typeface = juce::Typeface::createSystemTypefaceFor(
        BinaryData::Pixel_ttf, (size_t) BinaryData::Pixel_ttfSize);
    return typeface;
}

juce::Font pixelFont(float height)
{
    return juce::Font(juce::FontOptions(height).withTypeface(pixelTypeface()));
}

void styleSlider(juce::Slider& slider, bool isAmpControl)
{
    slider.setSliderStyle(juce::Slider::LinearHorizontal);
    slider.setTextBoxStyle(isAmpControl ? juce::Slider::TextBoxBelow : juce::Slider::TextBoxRight,
                           false,
                           isAmpControl ? 58 : 48,
                           isAmpControl ? 17 : 18);
    slider.setColour(juce::Slider::thumbColourId, lime);
    slider.setColour(juce::Slider::trackColourId, line);
    slider.setColour(juce::Slider::textBoxTextColourId, fg);
    slider.setColour(juce::Slider::textBoxBackgroundColourId, panel);
    slider.setColour(juce::Slider::textBoxOutlineColourId, line);
}
}

juce::Font GuitarFxRetroLookAndFeel::getTextButtonFont(juce::TextButton&, int buttonHeight)
{
    return pixelFont(juce::jmin(8.0f, (float) buttonHeight * 0.36f));
}

juce::Font GuitarFxRetroLookAndFeel::getComboBoxFont(juce::ComboBox&)
{
    return pixelFont(8.0f);
}

juce::Font GuitarFxRetroLookAndFeel::getLabelFont(juce::Label& label)
{
    return pixelFont(juce::jmin(8.0f, (float) label.getHeight() * 0.62f));
}

juce::Font GuitarFxRetroLookAndFeel::getPopupMenuFont()
{
    return pixelFont(8.0f);
}

GuitarFxRetroLookAndFeel::GuitarFxRetroLookAndFeel()
{
    setColour(juce::ComboBox::backgroundColourId, panel);
    setColour(juce::ComboBox::textColourId, fg);
    setColour(juce::ComboBox::outlineColourId, line);
    setColour(juce::ComboBox::arrowColourId, lime);
    setColour(juce::PopupMenu::backgroundColourId, panel);
    setColour(juce::PopupMenu::textColourId, fg);
    setColour(juce::PopupMenu::highlightedBackgroundColourId, lime);
    setColour(juce::PopupMenu::highlightedTextColourId, bg);
}

void GuitarFxRetroLookAndFeel::drawButtonBackground(juce::Graphics& g,
                                                     juce::Button& button,
                                                     const juce::Colour&,
                                                     bool isMouseOver,
                                                     bool isButtonDown)
{
    auto bounds = button.getLocalBounds().toFloat();
    auto fill = button.getToggleState() ? lime : panel;
    if (!button.isEnabled())
        fill = panel.withAlpha(0.55f);
    else if (isMouseOver)
        fill = fill.brighter(0.12f);
    if (isButtonDown)
        bounds = bounds.translated(2.0f, 2.0f);

    g.setColour(shadow);
    g.fillRect(button.getLocalBounds().toFloat().translated(3.0f, 3.0f));
    g.setColour(fill);
    g.fillRect(bounds.reduced(1.0f));
    g.setColour(button.getToggleState() ? lime : line);
    g.drawRect(bounds.reduced(1.0f), 2.0f);
}

void GuitarFxRetroLookAndFeel::drawButtonText(juce::Graphics& g,
                                               juce::TextButton& button,
                                               bool,
                                               bool)
{
    g.setFont(pixelFont(7.0f));
    g.setColour(button.getToggleState() ? bg : fg);
    g.drawFittedText(button.getButtonText(),
                     button.getLocalBounds().reduced(4, 2),
                     juce::Justification::centred,
                     1);
}

void GuitarFxRetroLookAndFeel::drawToggleButton(juce::Graphics& g,
                                                 juce::ToggleButton& button,
                                                 bool isMouseOver,
                                                 bool isButtonDown)
{
    auto bounds = button.getLocalBounds().toFloat();
    auto fill = button.getToggleState() ? lime : panel;
    if (!button.isEnabled())
        fill = panel.withAlpha(0.55f);
    else if (isMouseOver)
        fill = fill.brighter(0.12f);
    if (isButtonDown)
        bounds = bounds.translated(2.0f, 2.0f);

    g.setColour(shadow);
    g.fillRect(button.getLocalBounds().toFloat().translated(3.0f, 3.0f));
    g.setColour(fill);
    g.fillRect(bounds.reduced(1.0f));
    g.setColour(button.getToggleState() ? lime : line);
    g.drawRect(bounds.reduced(1.0f), 2.0f);
    g.setFont(pixelFont(7.0f));
    g.setColour(button.getToggleState() ? bg : fg);
    g.drawFittedText(button.getButtonText(),
                     button.getLocalBounds().reduced(4, 2),
                     juce::Justification::centred,
                     1);
}

void GuitarFxRetroLookAndFeel::drawComboBox(juce::Graphics& g,
                                             int width,
                                             int height,
                                             bool isButtonDown,
                                             int,
                                             int,
                                             int,
                                             int,
                                             juce::ComboBox&)
{
    auto bounds = juce::Rectangle<int>(0, 0, width, height).toFloat();
    g.setColour(shadow);
    g.fillRect(bounds.translated(3.0f, 3.0f));
    g.setColour(isButtonDown ? panel.brighter(0.12f) : panel);
    g.fillRect(bounds.reduced(1.0f));
    g.setColour(line);
    g.drawRect(bounds.reduced(1.0f), 2.0f);

    juce::Path arrow;
    const auto centreX = (float) width - 14.0f;
    const auto centreY = (float) height * 0.5f;
    arrow.addTriangle(centreX - 4.0f, centreY - 2.0f,
                      centreX + 4.0f, centreY - 2.0f,
                      centreX, centreY + 3.0f);
    g.setColour(lime);
    g.fillPath(arrow);
}

void GuitarFxRetroLookAndFeel::drawLinearSlider(juce::Graphics& g,
                                                 int x,
                                                 int y,
                                                 int width,
                                                 int height,
                                                 float sliderPos,
                                                 float,
                                                 float,
                                                 juce::Slider::SliderStyle style,
                                                 juce::Slider& slider)
{
    if (style != juce::Slider::LinearHorizontal)
    {
        LookAndFeel_V4::drawLinearSlider(g, x, y, width, height, sliderPos, 0.0f, 0.0f,
                                         style, slider);
        return;
    }

    const auto trackY = (float) y + (float) height * 0.43f;
    const auto track = juce::Rectangle<float>((float) x + 3.0f, trackY,
                                               (float) width - 6.0f, 5.0f);
    g.setColour(line.darker(0.45f));
    g.fillRect(track);
    g.setColour(lime);
    g.fillRect(juce::Rectangle<float>(track.getX(), track.getY(),
                                      juce::jlimit(0.0f, track.getWidth(),
                                                   sliderPos - track.getX()),
                                      track.getHeight()));
    g.setColour(shadow);
    g.fillRect(juce::Rectangle<float>(sliderPos - 5.0f, trackY - 5.0f, 12.0f, 16.0f));
    g.setColour(lavender);
    g.fillRect(juce::Rectangle<float>(sliderPos - 6.0f, trackY - 6.0f, 12.0f, 16.0f));
    g.setColour(purple);
    g.drawRect(juce::Rectangle<float>(sliderPos - 6.0f, trackY - 6.0f, 12.0f, 16.0f), 2.0f);
}

NichodevGuitarFXAudioProcessorEditor::NichodevGuitarFXAudioProcessorEditor(
    NichodevGuitarFXAudioProcessor& p)
    : AudioProcessorEditor(&p), processor(p)
{
    setLookAndFeel(&retroLookAndFeel);
    setColour(juce::ResizableWindow::backgroundColourId, bg);

    for (auto* slider : {&masterSlider, &gainSlider, &toneSlider})
        styleSlider(*slider, true);

    addAndMakeVisible(masterSlider);
    addAndMakeVisible(gainSlider);
    addAndMakeVisible(toneSlider);
    masterAttachment = std::make_unique<SliderAttachment>(processor.parameters, "master", masterSlider);
    gainAttachment = std::make_unique<SliderAttachment>(processor.parameters, "ampGain", gainSlider);
    toneAttachment = std::make_unique<SliderAttachment>(processor.parameters, "ampTone", toneSlider);

    presets.addItem("SELECIONAR PRESET", 1);
    presets.addItem("CLEAN PIXEL", 2);
    presets.addItem("8-BIT BLUES", 3);
    presets.addItem("ARCADE CRUNCH", 4);
    presets.addItem("BOSS BATTLE", 5);
    presets.addItem("SPACE DELAY", 6);
    addAndMakeVisible(presets);
    addAndMakeVisible(randomButton);
    addAndMakeVisible(resetButton);

    presets.onChange = [this]
    {
        switch (presets.getSelectedId())
        {
            case 2: processor.applyPreset("clean"); break;
            case 3: processor.applyPreset("blues"); break;
            case 4: processor.applyPreset("crunch"); break;
            case 5: processor.applyPreset("fuzz"); break;
            case 6: processor.applyPreset("space"); break;
            default: break;
        }
    };
    randomButton.onClick = [this] { processor.randomizeGuitar(); };
    resetButton.onClick = [this]
    {
        processor.resetGuitar();
        presets.setSelectedId(1, juce::dontSendNotification);
    };

    for (int i = 0; i < NichodevGuitarFXAudioProcessor::pedalCount; ++i)
    {
        const auto index = (size_t) i;
        auto& button = pedalButtons[index];
        auto& slider = pedalSliders[index];

        styleSlider(slider, false);
        button.setButtonText(NichodevGuitarFXAudioProcessor::names[index]);
        if (i == 4)
            button.setTooltip("GE-7 TILT: equalizador de inclinacao tonal, nao um grafico de sete bandas.");
        button.setClickingTogglesState(true);
        addAndMakeVisible(button);
        addAndMakeVisible(slider);
        addAndMakeVisible(upButtons[index]);
        addAndMakeVisible(downButtons[index]);

        upButtons[index].setButtonText("UP");
        downButtons[index].setButtonText("DN");
        upButtons[index].onClick = [this, i] { processor.movePedal(i, -1); resized(); };
        downButtons[index].onClick = [this, i] { processor.movePedal(i, 1); resized(); };

        const auto id = juce::String(NichodevGuitarFXAudioProcessor::ids[index]);
        sliderAttachments[index] = std::make_unique<SliderAttachment>(processor.parameters, id, slider);
        buttonAttachments[index] = std::make_unique<ButtonAttachment>(
            processor.parameters, id + "On", button);
    }

    setResizable(true, true);
    setResizeLimits(760, 600, 1280, 1120);
    setSize(760, 600);
}

NichodevGuitarFXAudioProcessorEditor::~NichodevGuitarFXAudioProcessorEditor()
{
    setLookAndFeel(nullptr);
}

void NichodevGuitarFXAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(bg);

    auto outer = getLocalBounds().toFloat().reduced(10.0f);
    g.setColour(line);
    g.drawRect(outer, 3.0f);

    g.setColour(orange);
    g.setFont(pixelFont(7.0f));
    g.drawText("NICHODEVS / AUDIO ARCADE", 24, 14, getWidth() - 48, 16,
               juce::Justification::centredLeft);

    g.setColour(lime);
    g.setFont(pixelFont(16.0f));
    g.drawText("GUITAR FX LAB", 24, 31, getWidth() - 48, 30,
               juce::Justification::centredLeft);

    g.setColour(muted);
    g.setFont(pixelFont(8.0f));
    g.drawText("VST3  /  15 PEDAIS  /  AUDIO NATIVO", 24, 58, getWidth() - 48, 16,
               juce::Justification::centredLeft);

    auto amp = juce::Rectangle<float>(18.0f, 82.0f, (float) getWidth() - 36.0f, 130.0f);
    g.setColour(shadow);
    g.fillRect(amp.translated(6.0f, 6.0f));
    g.setColour(purple);
    g.fillRect(amp);
    g.setColour(purpleEdge);
    g.drawRect(amp, 4.0f);

    g.setColour(lavender);
    g.setFont(pixelFont(7.0f));
    g.drawText("MODEL: PIXEL-8b", 30, 88, 170, 16, juce::Justification::centredLeft);

    g.setColour(lavender);
    g.setFont(pixelFont(10.0f));
    g.drawText("AMP", 34, 108, 48, 26, juce::Justification::centred);

    g.setColour(fg);
    g.setFont(pixelFont(9.0f));
    g.drawText("NICHODEV", 30, 137, 160, 18, juce::Justification::centred);
    g.setColour(lavender);
    g.setFont(pixelFont(7.0f));
    g.drawText("ARCADE AMP", 30, 156, 160, 16, juce::Justification::centred);

    const auto controlX = 205;
    const auto controlW = (getWidth() - controlX - 32) / 3;
    const juce::String labels[] = {"MASTER", "GAIN", "TONE"};
    for (int i = 0; i < 3; ++i)
    {
        g.setColour(lavender);
        g.setFont(pixelFont(7.0f));
        g.drawText(labels[i], controlX + i * controlW, 94, controlW - 8, 16,
                   juce::Justification::centred);
    }

    g.setColour(lavender.withAlpha(0.45f));
    for (int i = 0; i < 9; ++i)
        g.fillRect(juce::Rectangle<float>(30.0f + i * 18.0f, 201.0f, 11.0f, 3.0f));

    g.setColour(lime);
    g.setFont(pixelFont(9.0f));
    g.drawText("FX CHAIN  /  15 PEDALS", 24, 224, getWidth() - 48, 20,
               juce::Justification::centredLeft);
    g.setColour(muted);
    g.setFont(pixelFont(7.0f));
    g.drawText("ORDEM DO SINAL DE CIMA PARA BAIXO  /  UP/DN REORDENAM", 24, 244,
               getWidth() - 48, 16, juce::Justification::centredLeft);

    const int top = 270;
    const int rowH = juce::jlimit(33, 48, (getHeight() - top - 42) / 8);
    const int colW = (getWidth() - 58) / 2;
    for (int i = 0; i < NichodevGuitarFXAudioProcessor::pedalCount; ++i)
    {
        const int col = i < 8 ? 0 : 1;
        const int row = i < 8 ? i : i - 8;
        const int x = 24 + col * (colW + 10);
        const int y = top + row * rowH;
        g.setColour(panel);
        g.fillRect(x, y, colW, rowH - 5);
        g.setColour(line);
        g.drawRect(x, y, colW, rowH - 5, 2);
    }

    g.setColour(muted);
    g.setFont(pixelFont(7.0f));
    g.drawText("OFF MANTEM OS AJUSTES  /  VALORES AUTOMATIZAVEIS NO DAW",
               24, getHeight() - 22, getWidth() - 48, 16,
               juce::Justification::centredLeft);
}

void NichodevGuitarFXAudioProcessorEditor::resized()
{
    const int width = getWidth();
    const int controlX = 205;
    const int controlW = (width - controlX - 32) / 3;

    masterSlider.setBounds(controlX, 108, controlW - 8, 58);
    gainSlider.setBounds(controlX + controlW, 108, controlW - 8, 58);
    toneSlider.setBounds(controlX + 2 * controlW, 108, controlW - 8, 58);

    const int presetY = 172;
    const int innerWidth = width - 60;
    const int resetWidth = 80;
    const int randomWidth = 92;
    const int gap = 10;
    const int presetWidth = innerWidth - resetWidth - randomWidth - 2 * gap;
    presets.setBounds(30, presetY, presetWidth, 25);
    randomButton.setBounds(30 + presetWidth + gap, presetY, randomWidth, 25);
    resetButton.setBounds(30 + presetWidth + gap + randomWidth + gap, presetY,
                          resetWidth, 25);

    const int top = 270;
    const int rowH = juce::jlimit(33, 48, (getHeight() - top - 42) / 8);
    const int colW = (width - 58) / 2;
    for (int position = 0; position < NichodevGuitarFXAudioProcessor::pedalCount; ++position)
    {
        const int col = position < 8 ? 0 : 1;
        const int row = position < 8 ? position : position - 8;
        const int x = 24 + col * (colW + 10);
        const int y = top + row * rowH + 4;
        const auto index = (size_t) processor.getPedalAtPosition(position);
        if (index >= NichodevGuitarFXAudioProcessor::pedalCount)
            continue;

        pedalButtons[index].setBounds(x + 6, y + 2, 110, rowH - 13);
        pedalSliders[index].setBounds(x + 120, y + 2, colW - 187, rowH - 13);
        upButtons[index].setBounds(x + colW - 58, y + 2, 24, rowH - 13);
        downButtons[index].setBounds(x + colW - 29, y + 2, 24, rowH - 13);
    }
}
