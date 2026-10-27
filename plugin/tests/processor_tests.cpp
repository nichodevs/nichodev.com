#include "PluginProcessor.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>

namespace
{
int failures = 0;

void expect(bool condition, const char* description)
{
    if (!condition)
    {
        std::cerr << "FAIL: " << description << '\n';
        ++failures;
    }
}

float parameterValue(const NichodevGuitarFXAudioProcessor& processor, const char* id)
{
    const auto* value = processor.parameters.getRawParameterValue(id);
    return value != nullptr ? value->load() : -1.0f;
}

void testOrderStateRoundTrip()
{
    NichodevGuitarFXAudioProcessor processor;
    processor.movePedal(7, -1);
    expect(processor.getPedalAtPosition(6) == 7, "moving a pedal updates the stored chain order");
    juce::MemoryBlock state;
    processor.getStateInformation(state);
    const auto reorderedRevision = processor.getOrderRevision();

    processor.resetGuitar();
    bool defaultOrder = true;
    for (int position = 0; position < NichodevGuitarFXAudioProcessor::pedalCount; ++position)
        defaultOrder = defaultOrder && processor.getPedalAtPosition(position) == position;
    expect(defaultOrder, "RESET restores the default pedal order");
    expect(processor.getOrderRevision() != reorderedRevision,
           "RESET invalidates the editor's displayed order revision");
    const auto resetRevision = processor.getOrderRevision();

    processor.setStateInformation(state.getData(), static_cast<int>(state.getSize()));
    expect(processor.getPedalAtPosition(6) == 7 && processor.getPedalAtPosition(7) == 6,
           "host state restoration restores the saved pedal order");
    expect(processor.getOrderRevision() != resetRevision,
           "host state restoration invalidates the editor's displayed order revision");
}

void testReportedReverbTail()
{
    NichodevGuitarFXAudioProcessor processor;
    const auto reportedTail = processor.getTailLengthSeconds();

    for (int configuration = 0; configuration < 3; ++configuration)
    {
        const auto sampleRate = configuration == 2 ? 48000.0 : 1000.0;
        guitarfx::dsp::GuitarFxEngine engine;
        engine.prepare(sampleRate);
        std::array<float, 15> amounts{}, enabled{};
        std::array<int, 15> order{};
        for (int pedal = 0; pedal < 15; ++pedal)
        {
            const auto index = static_cast<std::size_t>(pedal);
            order[index] = pedal;
            if (pedal == 13 || (configuration == 1 && guitarfx::dsp::needsDelayBuffer(pedal)))
                amounts[index] = enabled[index] = 1.0f;
        }

        if (configuration == 2)
        {
            order = {{13, 12, 14, 5, 6, 10, 1, 2, 3, 4, 7, 8, 9, 11, 0}};
            amounts.fill(1.0f);
            enabled.fill(1.0f);
            enabled[0] = 0.0f;
        }

        float latePeak = 0.0f;
        float afterReportedTail = 0.0f;
        const auto samples = static_cast<int>(std::ceil((reportedTail + 0.8) * sampleRate));
        for (int sample = 0; sample < samples; ++sample)
        {
            const auto input = sample == 0 ? 0.8f : 0.0f;
            const auto output = engine.processSample(input, 0, amounts, enabled, order,
                                                      1.0f, 1.0f, 0.5f);
            if (sample >= static_cast<int>(4.0 * sampleRate))
                latePeak = std::max(latePeak, std::abs(output));
            if (sample >= static_cast<int>(reportedTail * sampleRate))
                afterReportedTail = std::max(afterReportedTail, std::abs(output));
        }
        expect(latePeak > 0.01f,
               "maximum temporal feedback retains audible echoes after four seconds");
        expect(afterReportedTail < 1.0e-4f,
               "the reported tail covers maximum feedback and downstream drive below minus eighty dB");
    }
}

}

int main()
{
    testOrderStateRoundTrip();
    testReportedReverbTail();

    constexpr double sampleRate = 48000.0;
    constexpr int blockSize = 256;
    constexpr int totalSamples = 48000;
    constexpr int delayedWindowStart = 10000;

    NichodevGuitarFXAudioProcessor processor;
    processor.prepareToPlay(sampleRate, blockSize);
    processor.applyPreset("space");

    expect(parameterValue(processor, "ns2On") < 0.5f,
           "Space Delay disables the input gate through processor parameters");
    expect(parameterValue(processor, "dd8On") > 0.5f,
           "Space Delay enables DD-8 through processor parameters");
    expect(parameterValue(processor, "rv6On") > 0.5f,
           "Space Delay enables RV-6 through processor parameters");
    expect(std::abs(parameterValue(processor, "dd8") - 0.62f) < 1.0e-4f,
           "Space Delay sets the DD-8 amount through processor parameters");
    expect(std::abs(parameterValue(processor, "rv6") - 0.58f) < 1.0e-4f,
           "Space Delay sets the RV-6 amount through processor parameters");

    juce::AudioBuffer<float> block(2, blockSize);
    juce::MidiBuffer midi;

    // Let the processor's 20 ms parameter smoothers settle before the impulse.
    for (int i = 0; i < 4; ++i)
    {
        block.clear();
        processor.processBlock(block, midi);
    }

    float delayedPeak = 0.0f;
    float rightPeak = 0.0f;
    bool finiteOutput = true;

    for (int offset = 0; offset < totalSamples; offset += blockSize)
    {
        block.clear();
        if (offset == 0)
            block.setSample(0, 0, 0.8f);

        processor.processBlock(block, midi);

        for (int sample = 0; sample < blockSize; ++sample)
        {
            const int absoluteSample = offset + sample;
            const float left = block.getSample(0, sample);
            const float right = block.getSample(1, sample);
            finiteOutput = finiteOutput && std::isfinite(left) && std::isfinite(right);

            if (absoluteSample >= delayedWindowStart)
                delayedPeak = std::max(delayedPeak, std::abs(left));
            rightPeak = std::max(rightPeak, std::abs(right));
        }
    }

    expect(finiteOutput, "Space Delay processor output remains finite");
    expect(delayedPeak > 1.0e-5f,
           "Space Delay produces a delayed response through JUCE processBlock");
    expect(rightPeak < 1.0e-6f,
           "Space Delay processor path keeps the silent right channel isolated");

    processor.releaseResources();

    if (failures != 0)
        return EXIT_FAILURE;

    std::cout << "All VST3 processor integration tests passed.\n";
    return EXIT_SUCCESS;
}
