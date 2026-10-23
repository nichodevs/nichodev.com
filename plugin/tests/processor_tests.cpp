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
}

int main()
{
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
