#include "TunerProcessor.h"
#include <cstdlib>
#include <iostream>

namespace
{
int failures = 0;
void expect(bool condition, const char* description)
{
    if (!condition) { std::cerr << "FAIL: " << description << '\n'; ++failures; }
}

void feed(BitunerAudioProcessor& processor, double frequency, int mode)
{
    juce::MidiBuffer midi;
    for (int offset = 0; offset < 19200; offset += 256)
    {
        juce::AudioBuffer<float> block(2, 256);
        block.clear();
        for (int i = 0; i < 256; ++i)
        {
            const auto value = static_cast<float>(0.2 * std::sin(juce::MathConstants<double>::twoPi
                * frequency * (offset + i) / 48000.0));
            if (mode != 1) block.setSample(0, i, value);
            block.setSample(1, i, mode == 2 ? -value : value);
        }
        processor.processBlock(block, midi);
    }
}

bool waitForFrequency(BitunerAudioProcessor& processor, double target)
{
    for (int i = 0; i < 150; ++i)
    {
        juce::Thread::sleep(10);
        if (std::abs(processor.getDetectedFrequency() - target) < 0.5)
            return true;
    }
    return false;
}
}

int main(int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI initialise;
    if (argc < 2) return EXIT_FAILURE;
    BitunerAudioProcessor processor;
    processor.prepareToPlay(48000.0, 256);
    juce::MidiBuffer midi;
    juce::AudioBuffer<float> empty(2, 0);
    processor.processBlock(empty, midi);
    juce::AudioBuffer<float> padded(4, 256);
    padded.clear();
    padded.setSample(2, 20, 0.75f);
    padded.setSample(3, 20, -0.75f);
    processor.parameters.getParameter("mute")->setValueNotifyingHost(1.0f);
    processor.processBlock(padded, midi);
    expect(padded.getSample(2, 20) == 0.75f && padded.getSample(3, 20) == -0.75f,
           "channels outside the declared buses are not modified");
    processor.parameters.getParameter("mute")->setValueNotifyingHost(0.0f);
    const double targets[]{82.406889, 110.0, 146.832384};
    for (int mode = 0; mode < 3; ++mode)
    {
        feed(processor, targets[mode], mode);
        expect(waitForFrequency(processor, targets[mode]), "normal, right-only and inverted stereo each detect a new pitch");
    }
    auto* mute = processor.parameters.getParameter("mute");
    mute->setValueNotifyingHost(1.0f);
    feed(processor, 440.0, 1);
    expect(waitForFrequency(processor, 440.0), "analysis continues while output is muted");
    mute->setValueNotifyingHost(0.0f);
    feed(processor, targets[0] * std::pow(2.0, -12.0 / 1200.0), 0);
    expect(waitForFrequency(processor, 81.83765), "the analyser follows a detuned low E");
    std::unique_ptr<juce::AudioProcessorEditor> editor(processor.createEditorAndMakeActive());
    const auto* note = dynamic_cast<juce::Label*>(editor->findChildWithID("note"));
    expect(note != nullptr && note->getText() == "E2", "the native editor displays the detected scientific note");
    const auto* advice = dynamic_cast<juce::Label*>(editor->findChildWithID("advice"));
    expect(advice != nullptr && advice->getText() == "AUMENTE A AFINACAO", "negative cents request a higher tuning");
    juce::PNGImageFormat png;
    const auto screenshot = juce::File::getCurrentWorkingDirectory().getChildFile(argv[1]);
    { juce::FileOutputStream output(screenshot);
      expect(output.openedOk() && png.writeImageToStream(editor->createComponentSnapshot(editor->getLocalBounds()), output),
             "the actual native editor renders a preview"); }
    editor->setSize(840, 630);
    for (const auto& id : {"reference", "mute", "note", "advice"})
    {
        const auto* child = editor->findChildWithID(id);
        expect(child != nullptr && editor->getLocalBounds().contains(child->getBounds()), "resized controls stay inside the editor");
    }
    expect(waitForFrequency(processor, 0.0), "stopped input clears the previous pitch");
    juce::Timer::callAfterDelay(80, [] { juce::MessageManager::getInstance()->stopDispatchLoop(); });
    juce::MessageManager::getInstance()->runDispatchLoop();
    expect(note != nullptr && note->getText() == "--", "no signal clears the displayed note");
    editor.reset();
    processor.releaseResources();
    std::cout << "Tuner audio-thread, stereo routing, mute analysis and native editor tests completed.\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
