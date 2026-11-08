#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>

namespace bituner
{
struct Pitch
{
    int midiNote = -1;
    double cents = 0.0;
};

inline Pitch describePitch(double frequency, double reference)
{
    if (!std::isfinite(frequency) || frequency <= 0.0
        || !std::isfinite(reference) || reference < 430.0 || reference > 450.0)
        return {};
    const auto note = 69.0 + 12.0 * std::log2(frequency / reference);
    if (note < 0.0 || note > 127.0)
        return {};
    const auto nearest = static_cast<int>(std::round(note));
    return {nearest, (note - nearest) * 100.0};
}

// Monophonic YIN analysis. All storage is fixed; run this on the analysis thread.
class PitchDetector
{
public:
    static constexpr double minimumFrequency = 55.0;
    static constexpr double maximumFrequency = 1500.0;

    void prepare(double rate)
    {
        sampleRate = std::isfinite(rate) && rate >= 8000.0 && rate <= 384000.0 ? rate : 44100.0;
        decimation = std::max(1, static_cast<int>(sampleRate / 12000.0));
        analysisRate = sampleRate / decimation;
        filterCoefficient = 1.0 - std::exp(-2.0 * pi * 2000.0 / sampleRate);
        reset();
    }

    void reset()
    {
        samples.fill(0.0);
        filter.fill(0.0);
        writePosition = filled = hop = decimationPosition = 0;
        frequency = 0.0f;
    }

    bool push(float input)
    {
        double value = std::isfinite(input) ? std::clamp(static_cast<double>(input), -4.0, 4.0) : 0.0;
        for (auto& stage : filter)
        {
            stage += filterCoefficient * (value - stage);
            value = stage;
        }
        if (++decimationPosition < decimation)
            return false;
        decimationPosition = 0;
        samples[writePosition] = value;
        writePosition = (writePosition + 1) % frameSize;
        filled = std::min(filled + 1, frameSize);
        if (++hop < hopSize || filled < frameSize)
            return false;
        hop = 0;
        frequency = analyse();
        return true;
    }

    float getFrequency() const { return frequency; }

private:
    float analyse()
    {
        std::array<double, frameSize> frame{};
        double mean = 0.0;
        for (std::size_t i = 0; i < frameSize; ++i)
        {
            frame[i] = samples[(writePosition + i) % frameSize];
            mean += frame[i];
        }
        mean /= static_cast<double>(frameSize);
        double energy = 0.0;
        for (const auto value : frame)
            energy += (value - mean) * (value - mean);
        if (energy / static_cast<double>(frameSize) < 2.5e-7)
            return 0.0f;

        const auto minLag = std::max(2, static_cast<int>(analysisRate / maximumFrequency));
        const auto maxLag = std::min(static_cast<int>(frameSize / 2) - 1,
                                     static_cast<int>(std::ceil(analysisRate / minimumFrequency)));
        const auto comparisonSize = frameSize - static_cast<std::size_t>(maxLag) - 1;
        std::array<double, frameSize / 2> difference{};
        std::array<double, frameSize / 2> rawDifference{};
        double runningSum = 0.0;
        for (int lag = 1; lag <= maxLag; ++lag)
        {
            double sum = 0.0;
            for (std::size_t i = 0; i < comparisonSize; ++i)
            {
                const auto delta = frame[i] - frame[i + static_cast<std::size_t>(lag)];
                sum += delta * delta;
            }
            runningSum += sum;
            rawDifference[static_cast<std::size_t>(lag)] = sum;
            difference[static_cast<std::size_t>(lag)] = runningSum > 1.0e-20 ? sum * lag / runningSum : 1.0;
        }

        for (int lag = minLag; lag < maxLag; ++lag)
        {
            if (difference[static_cast<std::size_t>(lag)] >= 0.15)
                continue;
            while (lag + 1 < maxLag && difference[static_cast<std::size_t>(lag + 1)] < difference[static_cast<std::size_t>(lag)])
                ++lag;
            const auto a = rawDifference[static_cast<std::size_t>(lag - 1)];
            const auto b = rawDifference[static_cast<std::size_t>(lag)];
            const auto c = rawDifference[static_cast<std::size_t>(lag + 1)];
            const auto denominator = a - 2.0 * b + c;
            const auto offset = std::abs(denominator) > 1.0e-12
                ? std::clamp(0.5 * (a - c) / denominator, -0.5, 0.5) : 0.0;
            const auto result = analysisRate / (lag + offset);
            // Numerical interpolation can cross a supported endpoint by a fraction of a hertz.
            return result >= minimumFrequency - 0.01 && result <= maximumFrequency + 0.01
                ? static_cast<float>(result) : 0.0f;
        }
        return 0.0f;
    }

    static constexpr double pi = 3.14159265358979323846;
    static constexpr std::size_t frameSize = 1024;
    static constexpr std::size_t hopSize = 256;
    std::array<double, frameSize> samples{};
    std::array<double, 4> filter{};
    double sampleRate = 44100.0, analysisRate = 14700.0, filterCoefficient = 0.25;
    int decimation = 3, decimationPosition = 0;
    std::size_t writePosition = 0, filled = 0, hop = 0;
    float frequency = 0.0f;
};
}
