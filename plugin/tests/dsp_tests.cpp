#include "GuitarFxDSP.h"

#include <array>
#include <cmath>
#include <iostream>
#include <limits>
#include <numeric>

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
}

int main()
{
    std::array<int, 15> order{};
    std::iota(order.begin(), order.end(), 0);
    expect(guitarfx::dsp::movePedal(order, 5, -1), "pedal moves up");
    expect(order[4] == 5 && order[5] == 4, "up swaps adjacent pedals");
    expect(guitarfx::dsp::movePedal(order, 5, 1), "pedal moves down after a swap");
    expect(order[4] == 4 && order[5] == 5, "down restores adjacent order");
    expect(!guitarfx::dsp::movePedal(order, 0, -1), "first pedal cannot move above chain");
    expect(!guitarfx::dsp::movePedal(order, 14, 1), "last pedal cannot move below chain");
    expect(!guitarfx::dsp::movePedal(order, 5, 0), "invalid move delta is ignored");

    int delayPedals = 0;
    for (int pedal = 0; pedal < 15; ++pedal)
        delayPedals += guitarfx::dsp::needsDelayBuffer(pedal) ? 1 : 0;
    expect(delayPedals == 6, "only delay-based pedals allocate delay buffers");
    constexpr std::array<int, 6> delayPedalIds{{5, 6, 10, 12, 13, 14}};
    constexpr std::array<double, 6> expectedMaximumDelays{{.030, .0075, .0186, .41, .55, .71}};
    for (std::size_t i = 0; i < delayPedalIds.size(); ++i)
        expect(guitarfx::dsp::maximumDelaySeconds(delayPedalIds[i])
                   == expectedMaximumDelays[i],
               "per-pedal buffers cover the full supported delay range");

    const auto samples = guitarfx::dsp::delayBufferLength(48000.0);
    std::size_t samplesPerChannel = 0;
    for (int pedal = 0; pedal < 15; ++pedal)
        if (guitarfx::dsp::needsDelayBuffer(pedal))
            samplesPerChannel += guitarfx::dsp::delayBufferLength(
                48000.0, guitarfx::dsp::maximumDelaySeconds(pedal));
    const auto bytesPerInstance = samplesPerChannel * 2u * sizeof(float);
    expect(samples == 36002u, "delay buffer covers maximum delay with interpolation guard");
    expect(guitarfx::dsp::delayBufferLength(48000.0, .03) == 1442u,
           "per-pedal delay buffers retain their interpolation guard");
    expect(bytesPerInstance < 1024u * 1024u,
           "48 kHz delay buffers stay below one megabyte per stereo instance");
    expect(guitarfx::dsp::delayBufferLength(0.0) == 2u,
           "invalid sample rates produce a safe minimum delay buffer");
    expect(guitarfx::dsp::delayBufferLength(std::numeric_limits<double>::quiet_NaN()) == 2u,
           "non-finite sample rates produce a safe minimum delay buffer");
    expect(guitarfx::dsp::delayBufferLength(std::numeric_limits<double>::max())
               == std::numeric_limits<std::size_t>::max(),
           "extreme sample rates do not overflow the delay-buffer size calculation");

    guitarfx::dsp::DelayLine unpreparedDelay;
    expect(unpreparedDelay.read(.1f, 48000.0) == 0.0f,
           "an unprepared delay line safely returns silence");
    guitarfx::dsp::DelayLine finiteDelay;
    finiteDelay.prepare(8);
    finiteDelay.push(std::numeric_limits<float>::infinity());
    expect(finiteDelay.read(.001f, 1000.0) == 0.0f,
           "non-finite samples cannot poison a delay buffer");
    expect(std::isfinite(finiteDelay.read(std::numeric_limits<float>::max(), 1000.0)),
           "oversized delay requests are safely clamped to the allocated ring");

    const auto* spacePreset = guitarfx::dsp::findPreset("space");
    expect(spacePreset != nullptr, "Space Delay preset is registered");
    if (spacePreset != nullptr)
    {
        expect(!spacePreset->enabled[0], "Space Delay disables the input gate");
        expect(spacePreset->enabled[12] && spacePreset->enabled[13],
               "Space Delay enables DD-8 and RV-6");
        expect(std::abs(spacePreset->values[12] - .62f) < 1.0e-6f,
               "Space Delay sets the expected DD-8 amount");
        expect(std::abs(spacePreset->values[13] - .58f) < 1.0e-6f,
               "Space Delay sets the expected RV-6 amount");
    }
    expect(guitarfx::dsp::findPreset("unknown") == nullptr,
           "unknown preset names are rejected safely");
    for (const auto& preset : guitarfx::dsp::presets)
    {
        expect(guitarfx::dsp::findPreset(preset.id) == &preset,
               "every preset is discoverable by its id");
        for (const auto value : preset.values)
            expect(std::isfinite(value) && value >= 0.0f && value <= 1.0f,
                   "preset parameter values stay inside the host range");
    }

    for (int step = 0; step <= 1024; ++step)
    {
        constexpr float twoPi = 6.28318530717958647692f;
        const float phase = twoPi * static_cast<float>(step) / 1024.0f;
        const float coefficient = guitarfx::dsp::phaserFilterCoefficient(phase);
        expect(std::isfinite(coefficient) && coefficient >= .002f && coefficient <= .035001f,
               "PH-3 modulation keeps its filter coefficient positive and bounded");
    }

    {
        constexpr double testSampleRate = 44100.0;
        constexpr int testSamples = 44100 * 4;
        constexpr float twoPi = 6.28318530717958647692f;
        std::array<float, 15> amounts {{
            .20f,.20f,0,0,.52f,.38f,.22f,.35f,0,0,0,.15f,.62f,.58f,0
        }};
        std::array<float, 15> sevenEnabled {{
            0,1,0,0,1,1,1,0,0,0,0,1,1,1,0
        }};
        auto eightEnabled = sevenEnabled;
        eightEnabled[7] = 1.0f;
        std::array<int, 15> order{};
        std::iota(order.begin(), order.end(), 0);
        guitarfx::dsp::GuitarFxEngine sevenEffectEngine;
        guitarfx::dsp::GuitarFxEngine eightEffectEngine;
        sevenEffectEngine.prepare(testSampleRate);
        eightEffectEngine.prepare(testSampleRate);
        float phaserDifference = 0.0f;
        bool eightEffectOutputFinite = true;
        for (int sample = 0; sample < testSamples; ++sample)
        {
            const float input = .25f * std::sin(twoPi * 110.0f
                                                * static_cast<float>(sample) / testSampleRate);
            const float sevenOutput = sevenEffectEngine.processSample(
                input, 0, amounts, sevenEnabled, order, .718f, .12f, .2f);
            const float eightOutput = eightEffectEngine.processSample(
                input, 0, amounts, eightEnabled, order, .718f, .12f, .2f);
            eightEffectOutputFinite = eightEffectOutputFinite && std::isfinite(eightOutput);
            phaserDifference = std::max(phaserDifference, std::abs(eightOutput - sevenOutput));
        }
        expect(eightEffectOutputFinite,
               "the seven-effect chain remains finite when PH-3 is the eighth pedal enabled");
        expect(phaserDifference > 1.0e-4f,
               "PH-3 continues to process audio when enabled as the eighth pedal");
    }

    std::array<int, 15> defaultOrder{};
    std::iota(defaultOrder.begin(), defaultOrder.end(), 0);
    if (spacePreset != nullptr)
    {
        std::array<float, 15> spaceAmounts = spacePreset->values;
        std::array<float, 15> spaceEnabled{};
        for (std::size_t pedal = 0; pedal < spaceEnabled.size(); ++pedal)
            spaceEnabled[pedal] = spacePreset->enabled[pedal] ? 1.0f : 0.0f;

        auto spaceWithoutMainDelays = spaceEnabled;
        spaceWithoutMainDelays[12] = 0.0f;
        spaceWithoutMainDelays[13] = 0.0f;
        constexpr double testSampleRate = 48000.0;
        const int expectedDd8Sample = static_cast<int>(std::lround(
            (.09f + .32f * spaceAmounts[12]) * testSampleRate));
        const int expectedRv6Sample = static_cast<int>(std::lround(
            (.17f + .38f * spaceAmounts[13]) * testSampleRate));
        guitarfx::dsp::GuitarFxEngine spaceEngine;
        guitarfx::dsp::GuitarFxEngine comparisonEngine;
        spaceEngine.prepare(testSampleRate);
        comparisonEngine.prepare(testSampleRate);
        float dd8ChainDifference = 0.0f;
        float rv6ChainDifference = 0.0f;
        bool fullChainFinite = true;
        for (int sample = 0; sample <= expectedRv6Sample + 5; ++sample)
        {
            const float input = sample == 0 ? .5f : 0.0f;
            const float spaceOutput = spaceEngine.processSample(
                input, 0, spaceAmounts, spaceEnabled, defaultOrder, .55f, .12f, .2f);
            const float comparisonOutput = comparisonEngine.processSample(
                input, 0, spaceAmounts, spaceWithoutMainDelays,
                defaultOrder, .55f, .12f, .2f);
            fullChainFinite = fullChainFinite && std::isfinite(spaceOutput);
            const float difference = std::abs(spaceOutput - comparisonOutput);
            if (std::abs(sample - expectedDd8Sample) <= 3)
                dd8ChainDifference = std::max(dd8ChainDifference, difference);
            if (std::abs(sample - expectedRv6Sample) <= 3)
                rv6ChainDifference = std::max(rv6ChainDifference, difference);
        }
        expect(fullChainFinite, "the complete Space Delay DSP chain stays finite");
        expect(dd8ChainDifference > 1.0e-5f,
               "the complete Space Delay chain contains a DD-8 echo");
        expect(rv6ChainDifference > 1.0e-5f,
               "the complete Space Delay chain contains an RV-6 reflection");

        guitarfx::dsp::GuitarFxEngine bypassEngine;
        bypassEngine.prepare(testSampleRate);
        auto delayOnly = std::array<float, 15>{};
        delayOnly[12] = .62f;
        auto delayOnlyEnabled = std::array<float, 15>{};
        delayOnlyEnabled[12] = 1.0f;
        for (int sample = 0; sample < 100; ++sample)
        {
            const float input = sample == 0 ? .5f : 0.0f;
            bypassEngine.processSample(input, 0, delayOnly, delayOnlyEnabled,
                                       defaultOrder, .55f, .12f, .2f);
        }
        delayOnlyEnabled[12] = 0.0f;
        const auto dd8BufferLength = guitarfx::dsp::delayBufferLength(testSampleRate, .41);
        for (std::size_t sample = 0; sample < dd8BufferLength; ++sample)
            bypassEngine.processSample(0.0f, 0, delayOnly, delayOnlyEnabled,
                                       defaultOrder, .55f, .12f, .2f);
        delayOnlyEnabled[12] = 1.0f;
        float staleDelayOutput = 0.0f;
        for (int sample = 0; sample < 400; ++sample)
        {
            const float output = bypassEngine.processSample(
                0.0f, 0, delayOnly, delayOnlyEnabled,
                defaultOrder, .55f, .12f, .2f);
            staleDelayOutput = std::max(staleDelayOutput, std::abs(output));
        }
        expect(staleDelayOutput < 1.0e-5f,
               "audio played while DD-8 is bypassed does not return as a stale echo");

        guitarfx::dsp::GuitarFxEngine stereoEngine;
        stereoEngine.prepare(testSampleRate);
        float rightChannelLeak = 0.0f;
        for (int sample = 0; sample <= expectedRv6Sample + 5; ++sample)
        {
            const float input = sample == 0 ? .5f : 0.0f;
            stereoEngine.processSample(input, 0, spaceAmounts, spaceEnabled,
                                       defaultOrder, .55f, .12f, .2f);
            const float rightOutput = stereoEngine.processSample(
                0.0f, 1, spaceAmounts, spaceEnabled,
                defaultOrder, .55f, .12f, .2f);
            rightChannelLeak = std::max(rightChannelLeak, std::abs(rightOutput));
        }
        expect(rightChannelLeak < 1.0e-7f,
               "Space Delay keeps left-channel history out of the right channel");
    }

    guitarfx::dsp::GuitarFxEngine unpreparedEngine;
    const auto silence = std::array<float, 15>{};
    const auto disabled = std::array<float, 15>{};
    expect(std::isfinite(unpreparedEngine.processSample(
               .5f, 0, silence, disabled, defaultOrder, .55f, .12f, .2f)),
           "an unprepared engine fails safely on the dry path");

    guitarfx::dsp::GuitarFxEngine invalidControlEngine;
    invalidControlEngine.prepare(1000.0);
    auto invalidAmounts = std::array<float, 15>{};
    auto invalidEnabled = std::array<float, 15>{};
    invalidAmounts[6] = std::numeric_limits<float>::infinity();
    invalidEnabled[6] = 1.0f;
    invalidAmounts[7] = std::numeric_limits<float>::quiet_NaN();
    invalidEnabled[7] = std::numeric_limits<float>::quiet_NaN();
    const float invalidControlsOutput = invalidControlEngine.processSample(
        .5f, 0, invalidAmounts, invalidEnabled, defaultOrder,
        std::numeric_limits<float>::quiet_NaN(),
        std::numeric_limits<float>::infinity(),
        std::numeric_limits<float>::quiet_NaN());
    const float recoveredOutput = invalidControlEngine.processSample(
        .5f, 0, silence, disabled, defaultOrder, .55f, .12f, .2f);
    expect(std::isfinite(invalidControlsOutput) && std::isfinite(recoveredOutput),
           "non-finite host controls cannot poison later DSP processing");

    guitarfx::dsp::DelayLine dd8;
    dd8.prepare(guitarfx::dsp::delayBufferLength(1000.0));
    float dd8Phase = 0.0f;
    float dd8Filter = 0.0f;
    constexpr float noDcBlocking = 0.01f;
    const float dd8Dry = guitarfx::dsp::processDelayPedal(
        12, 1.0f, .62f, 1000.0, dd8, dd8Phase, dd8Filter, noDcBlocking);
    expect(dd8Dry > .70f && dd8Dry < .80f,
           "DD-8 preserves its expected dry signal on an impulse");
    float dd8Echo = 0.0f;
    for (int sample = 1; sample <= 288; ++sample)
    {
        const float output = guitarfx::dsp::processDelayPedal(
            12, 0.0f, .62f, 1000.0, dd8, dd8Phase, dd8Filter, noDcBlocking);
        if (sample == 288)
            dd8Echo = output;
    }
    expect(dd8Echo > .10f,
           "DD-8 produces the preset echo at approximately 288 ms");
    for (std::size_t sample = 0; sample < dd8.size(); ++sample)
        dd8.drain();
    expect(std::abs(dd8.read(.2884f, 1000.0)) < 1.0e-5f,
           "bypassed DD-8 clears old audio within one ring-buffer pass");

    guitarfx::dsp::DelayLine rv6;
    rv6.prepare(guitarfx::dsp::delayBufferLength(1000.0));
    float rv6Phase = 0.0f;
    float rv6Filter = 0.0f;
    guitarfx::dsp::processDelayPedal(
        13, 1.0f, .58f, 1000.0, rv6, rv6Phase, rv6Filter, noDcBlocking);
    float rv6Echo = 0.0f;
    for (int sample = 1; sample <= 390; ++sample)
    {
        const float output = guitarfx::dsp::processDelayPedal(
            13, 0.0f, .58f, 1000.0, rv6, rv6Phase, rv6Filter, noDcBlocking);
        if (sample == 390)
            rv6Echo = output;
    }
    expect(rv6Echo > .10f,
           "RV-6 produces the preset reflection at approximately 390 ms");

    guitarfx::dsp::DelayLine chorus;
    chorus.prepare(guitarfx::dsp::delayBufferLength(1000.0));
    chorus.push(1.0f);
    for (std::size_t sample = 0; sample < chorus.size(); ++sample)
        chorus.drain();
    expect(std::abs(chorus.read(.022f, 1000.0)) < 1.0e-6f,
           "bypassed chorus clears ring history by advancing with silence");

    expect(guitarfx::dsp::mixEffect(0.25f, -0.25f, 0.0f) == 0.25f,
           "disabled effect returns the dry signal");
    expect(guitarfx::dsp::mixEffect(0.25f, -0.25f, 1.0f) == -0.25f,
           "enabled effect returns the processed signal");
    expect(std::abs(guitarfx::dsp::mixEffect(0.25f, -0.25f, 0.5f)) < 1.0e-6f,
           "effect transitions blend dry and processed signals linearly");
    expect(guitarfx::dsp::mixEffect(0.25f, -0.25f, -1.0f) == 0.25f,
           "effect blend clamps below zero");
    expect(guitarfx::dsp::mixEffect(0.25f, -0.25f, 2.0f) == -0.25f,
           "effect blend clamps above one");

    float lowpass = 0.0f;
    constexpr float dcCoefficient = 0.0026f;
    expect(guitarfx::dsp::removeRectifierDc(0.0f, lowpass, dcCoefficient) == 0.0f,
           "rectifier produces silence from silence");
    for (int i = 0; i < 48000; ++i)
        guitarfx::dsp::removeRectifierDc(0.5f, lowpass, dcCoefficient);
    float finalOutput = 0.0f;
    for (int i = 0; i < 48000; ++i)
        finalOutput = guitarfx::dsp::removeRectifierDc(0.0f, lowpass, dcCoefficient);
    expect(std::abs(finalOutput) < 1.0e-5f,
           "rectifier DC blocker returns to silence after an input stops");


    {
        const auto measure = [](double sampleRate, int pedal) {
            guitarfx::dsp::GuitarFxEngine engine;
            engine.prepare(sampleRate);
            std::array<float, 15> amounts{}, enabled{};
            std::array<int, 15> order{};
            std::iota(order.begin(), order.end(), 0);
            amounts[static_cast<std::size_t>(pedal)] = 1.0f;
            enabled[static_cast<std::size_t>(pedal)] = 1.0f;
            const auto tone = 1.0f - std::exp(-6.28318530718f * 6000.0f / static_cast<float>(sampleRate));
            double energy = 0.0;
            int count = 0;
            for (int sample = 0; sample < static_cast<int>(sampleRate * .3); ++sample)
            {
                const auto time = sample / sampleRate;
                const auto amplitude = pedal == 4 ? .05f : time < .1 ? .8f : .035f;
                const auto input = amplitude * std::sin(6.28318530718 * 250.0 * time);
                const auto output = engine.processSample(static_cast<float>(input), 0, amounts, enabled, order, 1.0f, 0.0f, tone);
                const bool window = pedal == 4 ? time > .2 : time >= .105 && time < .12;
                if (window) { energy += output * output; ++count; }
            }
            return std::sqrt(energy / count);
        };
        for (const int pedal : {0, 1, 4, 7})
        {
            const auto reference = measure(44100.0, pedal);
            for (const double sampleRate : {48000.0, 96000.0, 192000.0})
            {
                const auto actual = measure(sampleRate, pedal);
                const auto ratio = actual / reference;
                if (std::abs(ratio - 1.0) >= .04)
                    std::cerr << "sample-rate response pedal=" << pedal << " rate=" << sampleRate << " ratio=" << ratio << '\n';
                expect(std::abs(ratio - 1.0) < .04,
                       "gate, compressor, EQ and phaser retain their time/frequency response across sample rates");
            }
        }
    }

    if (failures != 0)
        return 1;

    std::cout << "All VST3 DSP utility tests passed.\n";
    return 0;
}
