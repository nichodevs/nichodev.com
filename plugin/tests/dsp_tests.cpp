#include "GuitarFxDSP.h"

#include <array>
#include <cmath>
#include <iostream>
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
