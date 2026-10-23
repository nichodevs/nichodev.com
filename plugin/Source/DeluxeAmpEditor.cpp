#include "DeluxeAmpEditor.h"
#include "BinaryData.h"

namespace
{
const juce::Colour background{0xff10160f};
const juce::Colour panel{0xff1b2418};
const juce::Colour panelDark{0xff0b100b};
const juce::Colour foreground{0xffeaf2dc};
const juce::Colour muted{0xffa8b49a};
const juce::Colour line{0xff64734d};
const juce::Colour lime{0xffc9f27a};
const juce::Colour purple{0xff2b1d38};
const juce::Colour purpleEdge{0xff8d6ca8};
const juce::Colour lavender{0xffd9b2ff};
const juce::Colour shadow{0xff050805};

juce::Typeface::Ptr pixelTypeface()
{
    static auto typeface = juce::Typeface::createSystemTypefaceFor(
        BinaryData::Pixel_ttf, static_cast<std::size_t>(BinaryData::Pixel_ttfSize));
    return typeface;
}

juce::Font pixelFont(float height)
{
    return juce::Font(juce::FontOptions(height).withTypeface(pixelTypeface()));
}

void styleAmpSlider(juce::Slider& slider)
{
    slider.setSliderStyle(juce::Slider::LinearHorizontal);
    slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 58, 16);
    slider.setColour(juce::Slider::thumbColourId, lavender);
    slider.setColour(juce::Slider::trackColourId, line);
    slider.setColour(juce::Slider::textBoxTextColourId, foreground);
    slider.setColour(juce::Slider::textBoxBackgroundColourId, panelDark);
    slider.setColour(juce::Slider::textBoxOutlineColourId, line);
}

void drawPixelFrame(juce::Graphics& graphics, juce::Rectangle<int> bounds,
                    juce::Colour fill, juce::Colour edge)
{
    graphics.setColour(shadow);
    graphics.fillRect(bounds.translated(3, 3));
    graphics.setColour(edge);
    graphics.fillRect(bounds);
    graphics.setColour(fill);
    graphics.fillRect(bounds.reduced(4));
}
}

Deluxe65LookAndFeel::Deluxe65LookAndFeel()
{
    setColour(juce::TextButton::textColourOffId, foreground);
    setColour(juce::TextButton::textColourOnId, background);
    setColour(juce::ToggleButton::textColourId, foreground);
}

juce::Font Deluxe65LookAndFeel::getTextButtonFont(juce::TextButton&, int buttonHeight)
{
    return pixelFont(juce::jmin(9.0f, static_cast<float>(buttonHeight) * 0.34f));
}

juce::Font Deluxe65LookAndFeel::getToggleButtonFont(juce::ToggleButton&, int buttonHeight)
{
    return pixelFont(juce::jmin(9.0f, static_cast<float>(buttonHeight) * 0.38f));
}

juce::Font Deluxe65LookAndFeel::getLabelFont(juce::Label&)
{
    return pixelFont(9.0f);
}

juce::Font Deluxe65LookAndFeel::getComboBoxFont(juce::ComboBox&)
{
    return pixelFont(9.0f);
}

void Deluxe65LookAndFeel::drawButtonBackground(juce::Graphics& graphics, juce::Button& button,
                                                const juce::Colour&, bool highlighted, bool down)
{
    auto bounds = button.getLocalBounds().reduced(1);
    const bool selected = button.getToggleState();
    const auto fill = down ? lavender : (selected || highlighted ? lime : panelDark);
    const auto edge = selected || highlighted ? lime : line;
    graphics.setColour(shadow);
    graphics.fillRect(bounds.translated(2, 2));
    graphics.setColour(edge);
    graphics.fillRect(bounds);
    graphics.setColour(fill);
    graphics.fillRect(bounds.reduced(3));
}

void Deluxe65LookAndFeel::drawButtonText(juce::Graphics& graphics, juce::TextButton& button,
                                          bool, bool)
{
    const auto selected = button.getToggleState();
    graphics.setColour(selected ? background : foreground);
    graphics.setFont(getTextButtonFont(button, button.getHeight()));
    graphics.drawFittedText(button.getButtonText(), button.getLocalBounds().reduced(4),
                            juce::Justification::centred, 1);
}

void Deluxe65LookAndFeel::drawToggleButton(juce::Graphics& graphics,
                                            juce::ToggleButton& button, bool, bool)
{
    const auto bounds = button.getLocalBounds();
    const auto box = juce::Rectangle<int>(bounds.getX() + 3, bounds.getCentreY() - 7, 14, 14);
    graphics.setColour(button.getToggleState() ? lime : line);
    graphics.fillRect(box);
    graphics.setColour(panelDark);
    graphics.fillRect(box.reduced(3));
    if (button.getToggleState())
    {
        graphics.setColour(lime);
        graphics.fillRect(box.reduced(5));
    }
    graphics.setColour(foreground);
    graphics.setFont(getToggleButtonFont(button, button.getHeight()));
    graphics.drawFittedText(button.getButtonText(), bounds.withTrimmedLeft(24).reduced(1),
                            juce::Justification::centredLeft, 1);
}

void Deluxe65LookAndFeel::drawLinearSlider(juce::Graphics& graphics, int x, int y,
                                            int width, int height, float sliderPos,
                                            float minimumSliderPos, float maximumSliderPos,
                                            juce::Slider::SliderStyle style,
                                            juce::Slider& slider)
{
    if (style != juce::Slider::LinearHorizontal)
    {
        LookAndFeel_V4::drawLinearSlider(graphics, x, y, width, height, sliderPos,
                                         minimumSliderPos, maximumSliderPos, style, slider);
        return;
    }

    juce::ignoreUnused(slider);

    const auto centreY = static_cast<float>(y) + static_cast<float>(height) * 0.38f;
    graphics.setColour(panelDark);
    graphics.fillRect(static_cast<float>(x), centreY - 3.0f, static_cast<float>(width), 6.0f);
    graphics.setColour(line);
    graphics.fillRect(static_cast<float>(x), centreY - 1.0f, static_cast<float>(width), 2.0f);
    graphics.setColour(lime);
    graphics.fillRect(static_cast<float>(x), centreY - 2.0f,
                      juce::jmax(0.0f, sliderPos - static_cast<float>(x)), 4.0f);
    graphics.setColour(lavender);
    graphics.fillRect(juce::Rectangle<float>(sliderPos - 5.0f, centreY - 8.0f, 10.0f, 16.0f));
}

Deluxe65AudioProcessorEditor::Deluxe65AudioProcessorEditor(Deluxe65AudioProcessor& owner)
    : AudioProcessorEditor(&owner), processor(owner)
{
    setLookAndFeel(&retroLookAndFeel);
    setResizable(true, true);
    setResizeLimits(780, 540, 1120, 760);
    setSize(900, 620);

    channelButtons[0].setButtonText("NORMAL  /  CLEAN");
    channelButtons[1].setButtonText("VIBRATO  /  DIRTY");
    inputButtons[0].setButtonText("INPUT I");
    inputButtons[1].setButtonText("INPUT II  -6 dB");

    for (auto& button : channelButtons)
    {
        button.setClickingTogglesState(true);
        addAndMakeVisible(button);
    }
    for (auto& button : inputButtons)
    {
        button.setClickingTogglesState(true);
        addAndMakeVisible(button);
    }

    channelButtons[0].onClick = [this] { selectChannel(0); };
    channelButtons[1].onClick = [this] { selectChannel(1); };
    inputButtons[0].onClick = [this] { selectInput(0); };
    inputButtons[1].onClick = [this] { selectInput(1); };

    const std::array<const char*, 9> ids{
        deluxe65::parameterIds::normalVolume,
        deluxe65::parameterIds::vibratoDrive,
        deluxe65::parameterIds::master,
        deluxe65::parameterIds::bass,
        deluxe65::parameterIds::middle,
        deluxe65::parameterIds::treble,
        deluxe65::parameterIds::reverb,
        deluxe65::parameterIds::vibratoDepth,
        deluxe65::parameterIds::vibratoRate};
    const std::array<const char*, 9> names{
        "NORMAL VOLUME", "VIBRATO DRIVE", "MASTER", "BASS", "MIDDLE", "TREBLE",
        "SPRING REVERB", "VIBRATO DEPTH", "VIBRATO RATE (Hz)"};

    for (std::size_t i = 0; i < controls.size(); ++i)
    {
        styleAmpSlider(controls[i]);
        controls[i].setNumDecimalPlacesToDisplay(1);
        controlLabels[i].setText(names[i], juce::dontSendNotification);
        controlLabels[i].setColour(juce::Label::textColourId, foreground);
        controlLabels[i].setJustificationType(juce::Justification::centredLeft);
        addAndMakeVisible(controlLabels[i]);
        addAndMakeVisible(controls[i]);
        sliderAttachments[i] = std::make_unique<SliderAttachment>(processor.parameters,
                                                                   ids[i], controls[i]);
    }

    brightButton.setClickingTogglesState(true);
    vibratoButton.setClickingTogglesState(true);
    addAndMakeVisible(brightButton);
    addAndMakeVisible(vibratoButton);
    brightAttachment = std::make_unique<ButtonAttachment>(processor.parameters,
                                                            deluxe65::parameterIds::bright,
                                                            brightButton);
    vibratoAttachment = std::make_unique<ButtonAttachment>(processor.parameters,
                                                              deluxe65::parameterIds::vibratoOn,
                                                              vibratoButton);

    refreshSelectorButtons();
    startTimerHz(30);
}

Deluxe65AudioProcessorEditor::~Deluxe65AudioProcessorEditor()
{
    stopTimer();
    setLookAndFeel(nullptr);
}

void Deluxe65AudioProcessorEditor::timerCallback()
{
    refreshSelectorButtons();
}

void Deluxe65AudioProcessorEditor::selectChannel(int channel)
{
    auto* parameter = processor.parameters.getParameter(deluxe65::parameterIds::channel);
    parameter->setValueNotifyingHost(parameter->convertTo0to1(static_cast<float>(channel)));
    refreshSelectorButtons();
}

void Deluxe65AudioProcessorEditor::selectInput(int input)
{
    auto* parameter = processor.parameters.getParameter(deluxe65::parameterIds::input);
    parameter->setValueNotifyingHost(parameter->convertTo0to1(static_cast<float>(input)));
    refreshSelectorButtons();
}

void Deluxe65AudioProcessorEditor::refreshSelectorButtons()
{
    const auto channel = processor.parameters.getRawParameterValue(deluxe65::parameterIds::channel)->load();
    const auto input = processor.parameters.getRawParameterValue(deluxe65::parameterIds::input)->load();
    channelButtons[0].setToggleState(channel < 0.5f, juce::dontSendNotification);
    channelButtons[1].setToggleState(channel >= 0.5f, juce::dontSendNotification);
    inputButtons[0].setToggleState(input < 0.5f, juce::dontSendNotification);
    inputButtons[1].setToggleState(input >= 0.5f, juce::dontSendNotification);
}

void Deluxe65AudioProcessorEditor::paint(juce::Graphics& graphics)
{
    graphics.fillAll(background);
    auto frame = getLocalBounds().reduced(8);
    drawPixelFrame(graphics, frame, panelDark, line);

    const auto width = getWidth();
    drawPixelFrame(graphics, {20, 18, width - 40, 68}, purple, purpleEdge);
    graphics.setColour(lime);
    graphics.setFont(pixelFont(10.0f));
    graphics.drawText("NICHODEV  /  AMP ARCADE", 36, 25, width - 72, 16,
                      juce::Justification::centredLeft);
    graphics.setColour(lavender);
    graphics.setFont(pixelFont(22.0f));
    graphics.drawText("DELUXE 65", 36, 40, 310, 31, juce::Justification::centredLeft);
    graphics.setColour(foreground);
    graphics.setFont(pixelFont(9.0f));
    graphics.drawText("VST3  /  22 W  /  2 x 6V6  /  12AX7 + 12AT7",
                      width - 420, 48, 370, 18, juce::Justification::centredRight);

    drawPixelFrame(graphics, {20, 98, width - 40, 88}, panel, line);
    graphics.setColour(muted);
    graphics.setFont(pixelFont(8.0f));
    graphics.drawText("CHANNEL  /  NORMAL = CLEAN  -  VIBRATO = DIRTY", 34, 103,
                      width / 2 - 40, 14, juce::Justification::centredLeft);
    graphics.drawText("FOUR INPUT JACKS  /  I OR II PER CHANNEL", width / 2 + 8, 103,
                      width / 2 - 42, 14, juce::Justification::centredRight);

    drawPixelFrame(graphics, {20, 196, width - 40, getHeight() - 277}, panel, line);
    graphics.setColour(muted);
    graphics.setFont(pixelFont(8.0f));
    graphics.drawText("AMPLIFIER CONTROLS", 34, 201, 250, 14,
                      juce::Justification::centredLeft);

    const auto bottomY = getHeight() - 68;
    drawPixelFrame(graphics, {20, bottomY, 360, 48}, panel, line);
    drawPixelFrame(graphics, {394, bottomY, width - 414, 48}, purple, purpleEdge);
    graphics.setColour(lime);
    graphics.setFont(pixelFont(8.5f));
    graphics.drawText("JENSEN-STYLE C-12K  /  12 IN", 408, bottomY + 7,
                      width - 442, 15, juce::Justification::centredLeft);
    graphics.setColour(foreground);
    graphics.setFont(pixelFont(7.5f));
    graphics.drawText("SPRING TANK + TRUE PITCH VIBRATO  /  INDEPENDENT MODEL",
                      408, bottomY + 24, width - 442, 14,
                      juce::Justification::centredLeft);
}

void Deluxe65AudioProcessorEditor::resized()
{
    const auto width = getWidth();
    const auto controlsTop = 222;
    const auto footerY = getHeight() - 68;
    const auto halfWidth = width / 2;
    const auto selectorButtonWidth = (halfWidth - 58) / 2;
    channelButtons[0].setBounds(34, 125, selectorButtonWidth, 42);
    channelButtons[1].setBounds(42 + selectorButtonWidth, 125, selectorButtonWidth, 42);
    inputButtons[0].setBounds(halfWidth + 10, 125, selectorButtonWidth, 42);
    inputButtons[1].setBounds(halfWidth + 18 + selectorButtonWidth, 125,
                              selectorButtonWidth, 42);

    const auto cellWidth = (width - 80) / 3;
    const auto rowHeight = (footerY - controlsTop - 20) / 3;
    for (std::size_t i = 0; i < controls.size(); ++i)
    {
        const auto column = static_cast<int>(i % 3);
        const auto row = static_cast<int>(i / 3);
        const auto x = 34 + column * (cellWidth + 6);
        const auto y = controlsTop + row * rowHeight;
        controlLabels[i].setBounds(x + 4, y + 4, cellWidth - 18, 17);
        controls[i].setBounds(x + 2, y + 20, cellWidth - 14, rowHeight - 22);
    }

    brightButton.setBounds(30, footerY + 10, 148, 28);
    vibratoButton.setBounds(194, footerY + 10, 178, 28);
}
