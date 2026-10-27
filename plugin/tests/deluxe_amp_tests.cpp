#include "DeluxeAmpDSP.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <vector>

namespace
{
int failures = 0;

void expect(bool condition, const char* message)
{
    if (!condition)
    {
        std::cerr << "FAIL: " << message << '\n';
        ++failures;
    }
}

float rms(const std::vector<float>& samples)
{
    double sum = 0.0;
    for (const auto sample : samples)
        sum += static_cast<double>(sample) * sample;
    return samples.empty() ? 0.0f : static_cast<float>(std::sqrt(sum / samples.size()));
}

void testSampleRateStability()
{
    for (const auto sampleRate : {44100.0, 48000.0, 96000.0, 192000.0})
    {
        deluxe65::dsp::Deluxe65Engine engine;
        engine.prepare(sampleRate);
        deluxe65::dsp::Controls controls;
        controls.channel = 1.0f;
        controls.vibratoDrive = 10.0f;
        controls.master = 10.0f;
        controls.reverb = 10.0f;
        controls.vibratoDepth = 10.0f;
        controls.vibratoRate = 8.0f;
        controls.vibratoOn = 1.0f;

        bool finite = true;
        const auto sampleCount = static_cast<int>(sampleRate * 0.4);
        for (int sample = 0; sample < sampleCount; ++sample)
        {
            const auto input = 0.7f * std::sin(6.28318530718f * 220.0f
                                                * static_cast<float>(sample / sampleRate));
            for (int channel = 0; channel < 2; ++channel)
            {
                const auto output = engine.processSample(input, channel, controls);
                finite = finite && std::isfinite(output) && std::abs(output) <= 1.0f;
            }
        }
        expect(finite, "amp, spring reverb, and pitch vibrato stay bounded at common sample rates");
    }
}

void testChannelVoicings()
{
    constexpr double sampleRate = 48000.0;
    constexpr int sampleCount = 24000;
    deluxe65::dsp::Deluxe65Engine cleanEngine;
    deluxe65::dsp::Deluxe65Engine dirtyEngine;
    cleanEngine.prepare(sampleRate);
    dirtyEngine.prepare(sampleRate);

    deluxe65::dsp::Controls cleanControls;
    cleanControls.channel = 0.0f;
    cleanControls.normalVolume = 3.0f;
    cleanControls.master = 7.0f;
    cleanControls.reverb = 0.0f;

    auto dirtyControls = cleanControls;
    dirtyControls.channel = 1.0f;
    dirtyControls.vibratoDrive = 8.0f;

    std::vector<float> cleanSamples;
    std::vector<float> dirtySamples;
    cleanSamples.reserve(sampleCount);
    dirtySamples.reserve(sampleCount);
    double difference = 0.0;

    for (int sample = 0; sample < sampleCount; ++sample)
    {
        const auto input = 0.35f * std::sin(6.28318530718f * 330.0f
                                             * static_cast<float>(sample / sampleRate));
        const auto clean = cleanEngine.processSample(input, 0, cleanControls);
        const auto dirty = dirtyEngine.processSample(input, 0, dirtyControls);
        cleanSamples.push_back(clean);
        dirtySamples.push_back(dirty);
        if (sample > 2000)
            difference += std::abs(static_cast<double>(clean - dirty));
    }

    expect(rms(cleanSamples) > 0.005f, "Normal/Clean channel produces an audible signal");
    expect(rms(dirtySamples) > 0.005f, "Vibrato/Dirty channel produces an audible signal");
    expect(difference / (sampleCount - 2000) > 0.01,
           "Normal/Clean and Vibrato/Dirty channels have distinct transfer curves");
}

void testSecondInputAttenuation()
{
    constexpr double sampleRate = 48000.0;
    deluxe65::dsp::Deluxe65Engine inputOneEngine;
    deluxe65::dsp::Deluxe65Engine inputTwoEngine;
    inputOneEngine.prepare(sampleRate);
    inputTwoEngine.prepare(sampleRate);

    deluxe65::dsp::Controls inputOne;
    inputOne.normalVolume = 1.0f;
    inputOne.master = 5.0f;
    inputOne.reverb = 0.0f;
    auto inputTwo = inputOne;
    inputTwo.input = 1.0f;

    double energyOne = 0.0;
    double energyTwo = 0.0;
    for (int sample = 0; sample < 12000; ++sample)
    {
        const auto source = 0.12f * std::sin(6.28318530718f * 440.0f
                                              * static_cast<float>(sample / sampleRate));
        const auto one = inputOneEngine.processSample(source, 0, inputOne);
        const auto two = inputTwoEngine.processSample(source, 0, inputTwo);
        if (sample > 1000)
        {
            energyOne += static_cast<double>(one) * one;
            energyTwo += static_cast<double>(two) * two;
        }
    }
    expect(energyTwo < energyOne * 0.55,
           "Input II attenuates the Normal channel by approximately six decibels");
}

void testTruePitchVibrato()
{
    constexpr double sampleRate = 48000.0;
    deluxe65::dsp::PitchVibrato vibrato;
    vibrato.prepare(sampleRate);

    std::vector<int> positiveCrossings;
    float previous = 0.0f;
    for (int sample = 0; sample < static_cast<int>(sampleRate); ++sample)
    {
        const auto source = 0.5f * std::sin(6.28318530718f * 440.0f
                                            * static_cast<float>(sample / sampleRate));
        const auto output = vibrato.process(source, 1.0f, 5.0f);
        if (sample > 12000 && previous <= 0.0f && output > 0.0f)
            positiveCrossings.push_back(sample);
        previous = output;
    }

    int shortestPeriod = 10000;
    int longestPeriod = 0;
    for (std::size_t i = 1; i < positiveCrossings.size(); ++i)
    {
        const auto period = positiveCrossings[i] - positiveCrossings[i - 1];
        shortestPeriod = std::min(shortestPeriod, period);
        longestPeriod = std::max(longestPeriod, period);
    }
    expect(longestPeriod - shortestPeriod > 8,
           "modulated delay varies pitch instead of only changing amplitude");
}


void testNormalVolumeZero()
{
    constexpr double sampleRate = 48000.0;
    deluxe65::dsp::Deluxe65Engine engine;
    engine.prepare(sampleRate);
    deluxe65::dsp::Controls controls;
    controls.normalVolume = 0.0f;
    controls.master = 7.0f;
    controls.reverb = 0.0f;

    float peak = 0.0f;
    for (int sample = 0; sample < 12000; ++sample)
    {
        const auto input = 0.35f * std::sin(6.28318530718f * 220.0f
                                             * static_cast<float>(sample / sampleRate));
        peak = std::max(peak, std::abs(engine.processSample(input, 0, controls)));
    }
    expect(peak < 1.0e-7f, "Normal Volume zero silences the Clean channel");
}

void testVibratoDepthContinuity()
{
    constexpr double sampleRate = 48000.0;
    deluxe65::dsp::PitchVibrato zeroDepth;
    deluxe65::dsp::PitchVibrato smallDepth;
    zeroDepth.prepare(sampleRate);
    smallDepth.prepare(sampleRate);

    float difference = 0.0f;
    for (int sample = 0; sample < 12000; ++sample)
    {
        const auto input = 0.5f * std::sin(6.28318530718f * 100.0f
                                            * static_cast<float>(sample / sampleRate));
        const auto zero = zeroDepth.process(input, 0.0f, 4.0f);
        const auto small = smallDepth.process(input, 0.00011f, 4.0f);
        if (sample > 1000)
            difference = std::max(difference, std::abs(zero - small));
    }
    expect(difference < 0.001f,
           "crossing zero vibrato depth keeps the same continuous delayed path");
}

void testSpringReverbTail()
{
    constexpr double sampleRate = 48000.0;
    deluxe65::dsp::SpringReverb reverb;
    reverb.prepare(sampleRate, 0);
    float latePeak = 0.0f;
    for (int sample = 0; sample < static_cast<int>(sampleRate * 0.5); ++sample)
    {
        const auto input = sample == 0 ? 1.0f : 0.0f;
        const auto output = reverb.process(input, 1.0f);
        if (sample >= static_cast<int>(sampleRate * 0.12))
            latePeak = std::max(latePeak, std::abs(output));
    }
    expect(latePeak > 1.0e-5f, "spring reverb retains a decaying tail after an impulse");
}
}

int main()
{
    testSampleRateStability();
    testChannelVoicings();
    testSecondInputAttenuation();
    testTruePitchVibrato();
    testVibratoDepthContinuity();
    testNormalVolumeZero();
    testSpringReverbTail();

    if (failures != 0)
        return EXIT_FAILURE;

    std::cout << "All Deluxe 65 DSP tests passed.\n";
    return EXIT_SUCCESS;
}
