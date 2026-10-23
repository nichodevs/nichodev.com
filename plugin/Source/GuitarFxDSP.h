#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <iterator>
#include <limits>
#include <new>
#include <stdexcept>
#include <string_view>
#include <vector>

namespace guitarfx::dsp
{
constexpr bool needsDelayBuffer(int pedalIndex) noexcept
{
    return pedalIndex == 5 || pedalIndex == 6 || pedalIndex == 10
        || pedalIndex == 12 || pedalIndex == 13 || pedalIndex == 14;
}

// Maximum read time for each pedal at a normalized amount of 1.0.
constexpr double maximumDelaySeconds(int pedalIndex) noexcept
{
    switch (pedalIndex)
    {
        case 5: return .030;
        case 6: return .0075;
        case 10: return .0186;
        case 12: return .41;
        case 13: return .55;
        case 14: return .71;
        default: return 0.0;
    }
}

struct Preset
{
    std::string_view id;
    std::array<float, 15> values;
    std::array<bool, 15> enabled;
    float gain;
    float tone;
};

inline constexpr std::array<Preset, 5> presets {{
    {"clean", {.30f,.18f,0,0,.54f,0,0,0,0,0,0,0,0,0,0},
               {true,true,false,false,true,false,false,false,false,false,false,false,false,false,false}, .12f,.58f},
    {"blues", {.28f,.38f,.36f,0,.58f,.10f,0,0,0,0,0,0,.12f,.14f,0},
               {true,true,true,false,true,true,false,false,false,false,false,false,true,true,false}, .30f,.62f},
    {"crunch", {.35f,.26f,.28f,.46f,.60f,0,0,0,0,0,0,0,.08f,.15f,0},
                {true,true,true,true,true,false,false,false,false,false,false,false,true,true,false}, .58f,.58f},
    {"fuzz", {.46f,.40f,0,.78f,.42f,0,0,0,0,0,0,0,.12f,.10f,0},
             {true,true,false,true,true,false,false,false,false,false,false,false,true,true,false}, .58f,.58f},
    {"space", {.20f,.20f,0,0,.52f,.38f,.22f,.35f,0,0,0,.15f,.62f,.58f,0},
              {false,true,false,false,true,true,true,true,false,false,false,true,true,true,false}, .12f,.58f}
}};

inline const Preset* findPreset(std::string_view id) noexcept
{
    for (const auto& preset : presets)
        if (preset.id == id)
            return &preset;
    return nullptr;
}

inline std::size_t delayBufferLength(double sampleRate, double delaySeconds = .75) noexcept
{
    if (!std::isfinite(sampleRate) || sampleRate <= 0.0
        || !std::isfinite(delaySeconds) || delaySeconds <= 0.0)
        return 2;
    const double requestedSamples = std::ceil(sampleRate * delaySeconds);
    const auto maxSize = std::numeric_limits<std::size_t>::max();
    if (requestedSamples >= static_cast<double>(maxSize - 2u))
        return maxSize;
    return static_cast<std::size_t>(requestedSamples) + 2u;
}

class DelayLine
{
public:
    void prepare(std::size_t length)
    {
        samples.assign(length, 0.0f);
        writePosition = 0;
    }

    void release() noexcept
    {
        std::vector<float>().swap(samples);
        writePosition = 0;
    }

    void clear() noexcept
    {
        std::fill(samples.begin(), samples.end(), 0.0f);
        writePosition = 0;
    }

    std::size_t size() const noexcept { return samples.size(); }

    float read(float seconds, double sampleRate) const noexcept
    {
        if (samples.size() < 3 || !std::isfinite(seconds) || seconds <= 0.0f
            || !std::isfinite(sampleRate) || sampleRate <= 0.0)
            return 0.0f;

        const double maxDelay = static_cast<double>(samples.size() - 2);
        const double delaySamples = std::clamp(static_cast<double>(seconds) * sampleRate,
                                               1.0, maxDelay);
        double position = static_cast<double>(writePosition) - delaySamples;
        if (position < 0.0)
            position += static_cast<double>(samples.size());

        const auto index = static_cast<std::size_t>(position);
        const float fraction = static_cast<float>(position - static_cast<double>(index));
        const auto next = index + 1 < samples.size() ? index + 1 : 0;
        const float output = samples[index] * (1.0f - fraction) + samples[next] * fraction;
        return std::isfinite(output) ? output : 0.0f;
    }

    void push(float value) noexcept
    {
        if (samples.empty())
            return;
        samples[writePosition] = std::isfinite(value) ? value : 0.0f;
        if (++writePosition == samples.size())
            writePosition = 0;
    }

    // Replace one ring-buffer sample with silence while bypassed. This flushes old
    // audio in at most one buffer pass without feedback math or bulk clearing.
    void drain() noexcept
    {
        push(0.0f);
    }

private:
    std::vector<float> samples;
    std::size_t writePosition = 0;
};

inline float removeRectifierDc(float input, float& lowpass, float coefficient) noexcept;

inline float phaserFilterCoefficient(float phase) noexcept
{
    // A negative one-pole coefficient reverses damping during part of the LFO cycle.
    constexpr float minimumCoefficient = 0.002f;
    if (!std::isfinite(phase))
        return minimumCoefficient;
    return std::max(minimumCoefficient, .015f + .02f * std::sin(phase));
}

inline float processDelayPedal(int pedalIndex, float input, float amount,
                               double sampleRate, DelayLine& delay, float& phase,
                               float& filter, float dcBlockCoefficient) noexcept
{
    constexpr float twoPi = 6.28318530717958647692f;
    if (!std::isfinite(input))
        input = 0.0f;
    if (!std::isfinite(amount))
        amount = 0.0f;
    if (!std::isfinite(sampleRate) || sampleRate <= 0.0
        || sampleRate > std::numeric_limits<float>::max() || delay.size() < 3)
        return input;
    const float safeRate = static_cast<float>(sampleRate);
    amount = std::clamp(amount, 0.0f, 1.0f);
    if (!std::isfinite(phase)) phase = 0.0f;
    if (!std::isfinite(filter)) filter = 0.0f;
    if (!std::isfinite(dcBlockCoefficient)) dcBlockCoefficient = 0.0f;

    switch (pedalIndex)
    {
        case 5:
        case 6:
        {
            phase += twoPi * (pedalIndex == 5 ? .7f + .8f * amount : .15f + 1.1f * amount) / safeRate;
            if (phase > twoPi) phase -= twoPi;
            const float seconds = (pedalIndex == 5 ? .022f : .004f)
                + (pedalIndex == 5 ? .008f : .0035f) * amount
                    * (.5f + .5f * std::sin(phase));
            const float wet = delay.read(seconds, safeRate);
            delay.push(input);
            const float mix = .25f + .45f * amount;
            return input * (1.0f - mix) + wet * mix;
        }
        case 10:
            phase += twoPi * (.8f + 5.0f * amount) / safeRate;
            if (phase > twoPi) phase -= twoPi;
            {
                const float wet = delay.read(.012f + (.0006f + .006f * amount) * std::sin(phase), safeRate);
                delay.push(input);
                return wet;
            }
        case 12:
        {
            const float wet = delay.read(.09f + .32f * amount, safeRate);
            delay.push(input + wet * std::min(.42f, .48f * amount));
            const float mix = .08f + .3f * amount;
            return input * (1.0f - mix) + wet * mix;
        }
        case 13:
        {
            const float wet = delay.read(.17f + .38f * amount, safeRate);
            delay.push(input + wet * (.25f + .55f * amount));
            const float mix = .04f + .34f * amount;
            return input * (1.0f - mix) + wet * mix;
        }
        case 14:
        {
            const float wet = delay.read(.36f + .35f * amount, safeRate);
            const float octave = removeRectifierDc(input, filter, dcBlockCoefficient);
            delay.push(octave * .7f + wet * .55f);
            return input * .82f + wet * (.16f + .68f * amount);
        }
        default:
            return input;
    }
}

inline float mixEffect(float dry, float wet, float enabled) noexcept
{
    if (!std::isfinite(dry)) dry = 0.0f;
    if (!std::isfinite(wet)) wet = dry;
    const float mix = std::isfinite(enabled) ? std::clamp(enabled, 0.0f, 1.0f) : 0.0f;
    return dry + (wet - dry) * mix;
}

inline float removeRectifierDc(float input, float& lowpass, float coefficient) noexcept
{
    if (!std::isfinite(input)) input = 0.0f;
    if (!std::isfinite(lowpass)) lowpass = 0.0f;
    coefficient = std::isfinite(coefficient) ? std::clamp(coefficient, 0.0f, 1.0f) : 0.0f;
    const float rectified = std::abs(input);
    lowpass += coefficient * (rectified - lowpass);
    return rectified - lowpass;
}

struct PedalState
{
    DelayLine delay;
    float env = 0.0f;
    float smooth = 1.0f;
    float filter = 0.0f;
    float phase = 0.0f;
    bool wasBypassed = true;
};

class GuitarFxEngine
{
public:
    static constexpr int pedalCount = 15;

    void prepare(double sampleRate)
    {
        rate = std::isfinite(sampleRate) && sampleRate > 0.0 ? sampleRate : 44100.0;
        dcBlockCoefficient = 1.0f
            - std::exp(-6.28318530717958647692f * 20.0f / static_cast<float>(rate));
        try
        {
            for (int pedal = 0; pedal < pedalCount; ++pedal)
                for (auto& state : states[static_cast<std::size_t>(pedal)])
                    if (needsDelayBuffer(pedal))
                        state.delay.prepare(delayBufferLength(
                            rate, maximumDelaySeconds(pedal)));
                    else
                        state.delay.release();
        }
        catch (const std::bad_alloc&)
        {
            releaseDelayBuffers();
        }
        catch (const std::length_error&)
        {
            releaseDelayBuffers();
        }

        for (auto& pedal : states)
            for (auto& state : pedal)
                resetState(state);
        ampFilter.fill(0.0f);
        ampEnv.fill(0.0f);
    }

    void release() noexcept
    {
        for (auto& pedal : states)
            for (auto& state : pedal)
            {
                state.delay.clear();
                resetState(state);
            }
        ampFilter.fill(0.0f);
        ampEnv.fill(0.0f);
    }

    float processSample(float input, int channel,
                        const std::array<float, pedalCount>& amounts,
                        const std::array<float, pedalCount>& enabled,
                        const std::array<int, pedalCount>& order,
                        float master, float gain, float toneCoefficient) noexcept
    {
        if (!std::isfinite(input)) input = 0.0f;
        master = std::isfinite(master) ? std::clamp(master, 0.0f, 1.0f) : 0.0f;
        gain = std::isfinite(gain) ? std::clamp(gain, 0.0f, 1.0f) : 0.0f;
        toneCoefficient = std::isfinite(toneCoefficient)
            ? std::clamp(toneCoefficient, 0.0f, 1.0f) : 0.0f;
        const auto channelIndex = static_cast<std::size_t>(std::clamp(channel, 0, 1));

        for (const int pedal : order)
        {
            if (pedal < 0 || pedal >= pedalCount)
                continue;

            const auto index = static_cast<std::size_t>(pedal);
            auto& state = states[index][channelIndex];
            const float amount = std::isfinite(amounts[index])
                ? std::clamp(amounts[index], 0.0f, 1.0f) : 0.0f;
            const float mix = std::isfinite(enabled[index])
                ? std::clamp(enabled[index], 0.0f, 1.0f) : 0.0f;

            if (needsDelayBuffer(pedal) && state.delay.size() < 3)
                continue;

            if (mix <= 0.0f)
            {
                if (!needsDelayBuffer(pedal))
                {
                    if (!state.wasBypassed)
                        resetState(state);
                    continue;
                }

                state.delay.drain();
                if (!state.wasBypassed)
                    resetState(state);
                state.wasBypassed = true;
                continue;
            }

            state.wasBypassed = false;
            const float dry = input;
            const float in = input;
            float wet = in;

            switch (pedal)
            {
                case 0:
                {
                    state.env += (std::abs(in) > state.env ? .04f : .002f)
                        * (std::abs(in) - state.env);
                    const float target = state.env < (.012f + .11f * amount) ? .08f : 1.0f;
                    state.smooth += .004f * (target - state.smooth);
                    wet = in * state.smooth;
                    break;
                }
                case 1:
                {
                    state.env += (std::abs(in) > state.env ? .03f : .003f)
                        * (std::abs(in) - state.env);
                    const float threshold = .30f - .22f * amount;
                    const float target = state.env > threshold
                        ? std::pow(threshold / std::max(state.env, .0001f),
                                   1.0f - 1.0f / (1.0f + 6.0f * amount))
                        : 1.0f;
                    state.smooth += .01f * (target - state.smooth);
                    wet = in * state.smooth;
                    break;
                }
                case 2: wet = std::tanh(in * (1.0f + 18.0f * amount) * .75f); break;
                case 3:
                {
                    const float drive = 1.0f + 25.0f * amount;
                    wet = drive * in / (1.0f + drive * std::abs(in));
                    break;
                }
                case 4:
                    state.filter += .025f * (in - state.filter);
                    wet = in + (amount - .5f) * (in - state.filter) * 1.6f;
                    break;
                case 5:
                case 6:
                case 10:
                case 12:
                case 13:
                case 14:
                    wet = processDelayPedal(pedal, in, amount, rate, state.delay,
                                            state.phase, state.filter, dcBlockCoefficient);
                    break;
                case 7:
                    state.phase += 6.28318530717958647692f * (.15f + 1.4f * amount)
                        / static_cast<float>(rate);
                    if (state.phase > 6.28318530717958647692f)
                        state.phase -= 6.28318530717958647692f;
                    state.filter += phaserFilterCoefficient(state.phase) * (in - state.filter);
                    wet = .4f * in + .6f * (in - 2.0f * state.filter);
                    break;
                case 8: wet = std::tanh(in * (1.0f + 24.0f * amount) * 1.8f); break;
                case 9:
                {
                    const float octave = removeRectifierDc(in, state.filter, dcBlockCoefficient);
                    wet = std::tanh(octave * (1.0f + 20.0f * amount) * 1.8f);
                    break;
                }
                case 11:
                    state.phase += 6.28318530717958647692f * (2.0f + 8.0f * amount)
                        / static_cast<float>(rate);
                    if (state.phase > 6.28318530717958647692f)
                        state.phase -= 6.28318530717958647692f;
                    wet = in * (1.0f - .48f * amount
                        + .48f * amount * (.5f + .5f * std::sin(state.phase)));
                    break;
                default: break;
            }

            input = mixEffect(dry, wet, mix);
        }

        float output = std::tanh(input * (1.0f + gain * 1.5f) * (1.0f + gain * 7.0f));
        if (!std::isfinite(output)) output = 0.0f;
        ampFilter[channelIndex] += toneCoefficient * (output - ampFilter[channelIndex]);
        ampEnv[channelIndex] += .009f * (output - ampEnv[channelIndex]);
        output = ampFilter[channelIndex] + (output - ampEnv[channelIndex]) * .22f;
        output *= master;
        return std::isfinite(output) ? output : 0.0f;
    }

private:
    static void resetState(PedalState& state) noexcept
    {
        state.env = 0.0f;
        state.smooth = 1.0f;
        state.filter = 0.0f;
        state.phase = 0.0f;
        state.wasBypassed = true;
    }

    void releaseDelayBuffers() noexcept
    {
        for (auto& pedal : states)
            for (auto& state : pedal)
                state.delay.release();
    }

    std::array<std::array<PedalState, 2>, pedalCount> states {};
    std::array<float, 2> ampFilter {};
    std::array<float, 2> ampEnv {};
    double rate = 44100.0;
    float dcBlockCoefficient = 0.0f;
};

template <std::size_t Size>
bool movePedal(std::array<int, Size>& order, int pedalId, int delta) noexcept
{
    if (pedalId < 0 || pedalId >= static_cast<int>(Size) || (delta != -1 && delta != 1))
        return false;

    const auto current = std::find(order.begin(), order.end(), pedalId);
    if (current == order.end())
        return false;

    const auto targetIndex = std::distance(order.begin(), current) + delta;
    if (targetIndex < 0 || targetIndex >= static_cast<std::ptrdiff_t>(Size))
        return false;

    std::iter_swap(current, order.begin() + targetIndex);
    return true;
}
}
