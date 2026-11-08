#include <juce_audio_utils/juce_audio_utils.h>
#include <cmath>
#include <cstdlib>
#include <iostream>

namespace
{
int failures = 0;
void expect(bool condition, const char* message)
{
    if (!condition) { std::cerr << "FAIL: " << message << '\n'; ++failures; }
}

void feed(juce::AudioPluginInstance& plugin, int count, int channelMode = 0, double frequency = 82.406889)
{
    juce::MidiBuffer midi;
    for (int offset = 0; offset < count; offset += 256)
    {
        juce::AudioBuffer<float> block(2, juce::jmin(256, count - offset));
        block.clear();
        for (int i = 0; i < block.getNumSamples(); ++i)
        {
            const auto value = static_cast<float>(0.2 * std::sin(juce::MathConstants<double>::twoPi * frequency * (offset + i) / 48000.0));
            if (channelMode != 1) block.setSample(0, i, value);
            block.setSample(1, i, channelMode == 2 ? -value : value);
        }
        plugin.processBlock(block, midi);
    }
}

}

int main(int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI initialise;
    if (argc < 2) return EXIT_FAILURE;
    juce::VST3PluginFormat format;
    juce::OwnedArray<juce::PluginDescription> descriptions;
    format.findAllTypesForFile(descriptions, argv[1]);
    expect(descriptions.size() == 1, "the compiled VST3 scans as one independent plugin");
    if (descriptions.isEmpty()) return EXIT_FAILURE;
    expect(descriptions[0]->name == "8bituner", "the host sees the exact plugin name");
    juce::String error;
    auto plugin = format.createInstanceFromDescription(*descriptions[0], 48000.0, 256, error);
    if (plugin == nullptr) { std::cerr << error << '\n'; return EXIT_FAILURE; }
    plugin->setPlayConfigDetails(2, 2, 48000.0, 256);
    plugin->prepareToPlay(48000.0, 256);
    expect(plugin->getLatencySamples() == 0, "the dry path reports zero additional latency");
    expect(plugin->getTailLengthSeconds() == 0.0, "the tuner adds no effect tail");

    juce::AudioBuffer<float> dry(2, 256), original(2, 256);
    juce::MidiBuffer midi;
    for (int i = 0; i < 256; ++i)
    {
        dry.setSample(0, i, static_cast<float>(i - 128) / 256.0f);
        dry.setSample(1, i, static_cast<float>(128 - i) / 512.0f);
    }
    original.makeCopyOf(dry);
    plugin->processBlock(dry, midi);
    for (int channel = 0; channel < 2; ++channel)
        for (int i = 0; i < 256; ++i)
            expect(dry.getSample(channel, i) == original.getSample(channel, i), "unmuted samples pass through unchanged");

    std::unique_ptr<juce::AudioProcessorEditor> editor(plugin->createEditor());
    expect(editor != nullptr, "the compiled plugin opens its native editor");
    if (editor == nullptr) return EXIT_FAILURE;
    editor->addToDesktop(juce::ComponentPeer::windowIsTemporary);
    editor->setVisible(true);
    juce::MessageManager::getInstance()->runDispatchLoopUntil(50);
    expect(editor->getWidth() >= 560 && editor->getHeight() >= 420,
           "the VST3 view attaches to a native host window");
    for (int mode = 0; mode < 3; ++mode)
    {
        const double frequencies[]{82.406889, 110.0, 146.832384};
        feed(*plugin, 19200, mode, frequencies[mode]);
        juce::MessageManager::getInstance()->runDispatchLoopUntil(50);
    }

    juce::AudioProcessorParameter* mute = nullptr;
    juce::AudioProcessorParameter* reference = nullptr;
    for (auto* parameter : plugin->getParameters())
    {
        if (parameter->getName(128) == "Mute Output") mute = parameter;
        if (parameter->getName(128) == "A4 Reference") reference = parameter;
    }
    expect(mute != nullptr && reference != nullptr, "both controls are exposed to host automation");
    if (mute != nullptr && reference != nullptr)
    {
        mute->setValueNotifyingHost(1.0f);
        for (int channel = 0; channel < 2; ++channel)
            for (int i = 0; i < 256; ++i) dry.setSample(channel, i, 0.25f);
        plugin->processBlock(dry, midi);
        expect(dry.getSample(0, 0) < 0.25f && dry.getSample(0, 0) > dry.getSample(0, 255)
            && dry.getSample(0, 255) > 0.0f, "mute fades gradually instead of cutting the waveform abruptly");
        reference->setValueNotifyingHost(0.6f);
        feed(*plugin, 19200, 1, 442.0);
        dry.clear(); dry.addFrom(0, 0, original, 0, 0, 256);
        plugin->processBlock(dry, midi);
        expect(dry.getMagnitude(0, 256) == 0.0f, "mute reaches exact silence after its ramp");
        juce::MemoryBlock state;
        plugin->getStateInformation(state);
        mute->setValueNotifyingHost(0.0f); reference->setValueNotifyingHost(0.5f);
        plugin->setStateInformation(state.getData(), static_cast<int>(state.getSize()));
        expect(mute->getValue() > 0.99f && std::abs(reference->getValue() - 0.6f) < 0.001f,
               "the DAW restores mute and reference from saved plugin state");
        const char invalidState[] = "invalid state";
        plugin->setStateInformation(invalidState, static_cast<int>(sizeof(invalidState)));
        expect(mute->getValue() > 0.99f, "invalid state leaves valid settings intact");
        dry.makeCopyOf(original);
        plugin->processBlockBypassed(dry, midi);
        expect(dry.getSample(0, 40) == original.getSample(0, 40), "host bypass passes audio even with mute enabled");
    }
    editor->removeFromDesktop();
    editor.reset();
    plugin->releaseResources();
    plugin->setPlayConfigDetails(1, 1, 44100.0, 512);
    plugin->prepareToPlay(44100.0, 512);
    juce::AudioBuffer<float> mono(1, 512); mono.clear();
    plugin->processBlock(mono, midi);
    expect(plugin->getTotalNumInputChannels() == 1 && plugin->getTotalNumOutputChannels() == 1,
           "the host can reopen the plugin with mono input and a different sample rate");
    plugin->releaseResources();
    std::cout << "VST3 scan, native editor, routing, parameters and host-state tests completed.\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
