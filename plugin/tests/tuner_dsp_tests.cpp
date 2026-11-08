#include "TunerDSP.h"
#include <cstdlib>
#include <iostream>
#include <limits>
#include <random>

namespace
{
int failures = 0, checks = 0;
constexpr double pi = 3.14159265358979323846;
void expect(bool condition, const char* message)
{
    ++checks;
    if (!condition) { std::cerr << "FAIL: " << message << '\n'; ++failures; }
}

double measure(double rate, double frequency, double amplitude, bool harmonics = false, bool noisy = false)
{
    bituner::PitchDetector detector;
    detector.prepare(rate);
    std::mt19937 random(8);
    std::uniform_real_distribution<float> noise(-0.006f, 0.006f);
    const auto count = static_cast<int>(rate * 0.35);
    for (int i = 0; i < count; ++i)
    {
        const auto phase = 2.0 * pi * frequency * i / rate;
        const auto envelope = harmonics ? std::exp(-2.0 * i / rate) : 1.0;
        auto signal = std::sin(phase);
        if (harmonics)
            signal = 0.4 * signal + 0.7 * std::sin(2.0 * phase) + 0.25 * std::sin(3.0 * phase)
                + 0.12 * std::sin(4.0 * phase);
        detector.push(static_cast<float>(amplitude * envelope * signal + (noisy ? noise(random) : 0.0f)));
    }
    return detector.getFrequency();
}
}

int main()
{
    const std::array<double, 7> rates{{8000, 22050, 44100, 48000, 96000, 192000, 384000}};
    const std::array<double, 6> strings{{82.406889, 110.0, 146.832384, 195.997718, 246.941651, 329.627557}};
    double maximumError = 0.0;
    for (const auto rate : rates)
        for (const auto frequency : strings)
            for (const auto detune : {-35.0, 0.0, 27.0})
            {
                const auto target = frequency * std::pow(2.0, detune / 1200.0);
                const auto detected = measure(rate, target, 0.25);
                const auto error = detected > 0.0 ? std::abs(1200.0 * std::log2(detected / target)) : 9999.0;
                maximumError = std::max(maximumError, error);
                if (error >= 2.0)
                    std::cerr << "Rate " << rate << ", target " << target << ", detected " << detected << ", error " << error << '\n';
                expect(error < 2.0, "six guitar strings and detuning are within two cents across sample rates");
            }
    for (const auto rate : {44100.0, 48000.0, 96000.0})
        for (const auto frequency : {62.0, 73.416192, 82.406889, 110.0, 329.627557, 440.0, 880.0, 1318.510228})
        {
            const auto detected = measure(rate, frequency, 0.25, true, true);
            if (detected == 0.0 || std::abs(1200.0 * std::log2(detected / frequency)) >= 3.0)
                std::cerr << "Harmonics: rate " << rate << ", target " << frequency << ", detected " << detected << '\n';
            expect(detected > 0.0 && std::abs(1200.0 * std::log2(detected / frequency)) < 3.0,
                   "decaying guitar-like harmonics and noise retain the fundamental");
        }
    for (const auto frequency : {55.0, 1500.0})
    {
        const auto detected = measure(48000, frequency, 0.25);
        if (detected == 0.0) std::cerr << "Range endpoint: " << frequency << '\n';
        expect(detected > 0.0 && std::abs(1200.0 * std::log2(detected / frequency)) < 3.0,
               "both declared range endpoints are detected");
    }
    expect(measure(48000, 82.406889, 0.003) > 0.0, "quiet guitar signal is detected");
    expect(measure(48000, 110.0, 0.00001) == 0.0, "sub-threshold signal is rejected");
    expect(measure(48000, 110.0, 0.0) == 0.0, "silence is rejected");
    expect(measure(48000, 0.0, 0.0, false, true) == 0.0, "unpitched noise is rejected");

    bituner::PitchDetector detector;
    detector.prepare(48000);
    for (int i = 0; i < 24000; ++i)
        detector.push(static_cast<float>(0.4 + 0.2 * std::sin(2.0 * pi * 110.0 * i / 48000.0)));
    expect(std::abs(detector.getFrequency() - 110.0f) < 0.1f, "DC offset does not change the detected note");
    for (int i = 0; i < 12000; ++i) detector.push(0.4f);
    expect(detector.getFrequency() == 0.0f, "DC alone clears the previous note");
    for (int i = 0; i < 12000; ++i)
        detector.push(i % 2 == 0 ? std::numeric_limits<float>::quiet_NaN() : std::numeric_limits<float>::infinity());
    expect(detector.getFrequency() == 0.0f, "non-finite input cannot poison the analyser");
    detector.reset();
    expect(detector.getFrequency() == 0.0f, "reset clears the reading");
    for (int i = 0; i < 16000; ++i)
        detector.push(static_cast<float>(0.2 * std::sin(2.0 * pi * 329.627557 * i / 48000.0)));
    expect(std::abs(detector.getFrequency() - 329.627557f) < 0.5f, "new notes are detected after a reset");
    const auto calibrated = bituner::describePitch(442.0, 442.0);
    expect(calibrated.midiNote == 69 && std::abs(calibrated.cents) < 1.0e-8, "A4 calibration changes the tuning target");
    const auto detuned = bituner::describePitch(440.0 * std::pow(2.0, -12.0 / 1200.0), 440.0);
    expect(detuned.midiNote == 69 && std::abs(detuned.cents + 12.0) < 1.0e-7, "signed cents give the correct tuning direction");
    expect(bituner::describePitch(0.0, 440.0).midiNote == -1, "missing pitch is not reported as a note");
    expect(bituner::describePitch(440.0, 999.0).midiNote == -1, "invalid calibration is rejected");
    std::cout << checks << " tuner DSP checks; maximum sine error: " << maximumError << " cents.\n";
    return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
