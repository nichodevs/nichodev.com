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

    const auto samples = guitarfx::dsp::delayBufferLength(48000.0);
    const auto bytesPerInstance = samples * 6u * 2u * sizeof(float);
    expect(samples == 36002u, "delay buffer covers maximum delay with interpolation guard");
    expect(bytesPerInstance < 2u * 1024u * 1024u,
           "48 kHz delay buffers stay below two megabytes per instance");
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

    if (failures != 0)
        return 1;

    std::cout << "All VST3 DSP utility tests passed.\n";
    return 0;
}
