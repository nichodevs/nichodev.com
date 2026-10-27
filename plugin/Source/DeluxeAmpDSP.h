#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <vector>

namespace deluxe65::dsp
{
inline float finiteOr(float value, float fallback = 0.0f) noexcept
{
    return std::isfinite(value) ? value : fallback;
}

class DelayLine
{
public:
    void prepare(double sampleRate, double maximumSeconds)
    {
        const auto samples = std::max(2.0, std::ceil(sampleRate * maximumSeconds) + 2.0);
        buffer.assign(static_cast<std::size_t>(samples), 0.0f);
        writePosition = 0;
    }

    void clear() noexcept
    {
        std::fill(buffer.begin(), buffer.end(), 0.0f);
        writePosition = 0;
    }

    float read(float delaySamples) const noexcept
    {
        if (buffer.size() < 2 || !std::isfinite(delaySamples))
            return 0.0f;

        const auto maximumDelay = static_cast<double>(buffer.size() - 1);
        const auto delay = std::clamp(static_cast<double>(delaySamples), 1.0, maximumDelay);
        auto position = static_cast<double>(writePosition) - delay;
        while (position < 0.0)
            position += static_cast<double>(buffer.size());

        const auto index = static_cast<std::size_t>(position);
        const auto next = index + 1 == buffer.size() ? 0 : index + 1;
        const auto fraction = static_cast<float>(position - static_cast<double>(index));
        return buffer[index] + (buffer[next] - buffer[index]) * fraction;
    }

    void push(float value) noexcept
    {
        if (buffer.empty())
            return;
        buffer[writePosition] = finiteOr(value);
        if (++writePosition == buffer.size())
            writePosition = 0;
    }

private:
    std::vector<float> buffer;
    std::size_t writePosition = 0;
};

class PitchVibrato
{
public:
    void prepare(double sampleRate, float phaseOffset = 0.0f)
    {
        rate = std::isfinite(sampleRate) && sampleRate > 0.0 ? sampleRate : 44100.0;
        delay.prepare(rate, 0.014);
        initialPhase = phaseOffset;
        phase = initialPhase;
        delay.clear();
    }

    void reset() noexcept
    {
        delay.clear();
        phase = initialPhase;
    }

    // A modulated delay changes playback speed and therefore pitch. This is not
    // amplitude modulation/tremolo. The delay buffers are prepared off-thread.
    float process(float input, float depth, float rateHz) noexcept
    {
        input = finiteOr(input);
        depth = std::clamp(finiteOr(depth), 0.0f, 1.0f);
        rateHz = std::clamp(finiteOr(rateHz, 4.0f), 0.5f, 8.0f);

        const auto delayed = delay.read(static_cast<float>(rate * (0.007 + 0.0045 * depth
                                                                   * std::sin(phase))));
        delay.push(input);

        phase += 6.28318530717958647692f * rateHz / static_cast<float>(rate);
        if (phase >= 6.28318530717958647692f)
            phase -= 6.28318530717958647692f;

        return delayed;
    }

private:
    DelayLine delay;
    double rate = 44100.0;
    float initialPhase = 0.0f;
    float phase = 0.0f;
};

class SpringReverb
{
public:
    void prepare(double sampleRate, int channel)
    {
        const auto rate = std::isfinite(sampleRate) && sampleRate > 0.0 ? sampleRate : 44100.0;
        constexpr std::array<double, 4> leftTimes{0.0311, 0.0377, 0.0431, 0.0533};
        constexpr std::array<double, 4> rightTimes{0.0327, 0.0391, 0.0457, 0.0551};
        const auto& times = channel == 0 ? leftTimes : rightTimes;

        for (std::size_t i = 0; i < combs.size(); ++i)
        {
            combs[i].delay.prepare(rate, 0.060);
            combs[i].delaySamples = static_cast<float>(rate * times[i]);
            combs[i].damped = 0.0f;
        }

        constexpr std::array<double, 2> diffuserTimes{0.0067, 0.0091};
        for (std::size_t i = 0; i < diffusers.size(); ++i)
        {
            diffusers[i].delay.prepare(rate, 0.012);
            diffusers[i].delaySamples = static_cast<float>(rate * diffuserTimes[i]);
        }
    }

    void reset() noexcept
    {
        for (auto& comb : combs)
        {
            comb.delay.clear();
            comb.damped = 0.0f;
        }
        for (auto& diffuser : diffusers)
            diffuser.delay.clear();
    }

    float process(float input, float amount) noexcept
    {
        input = finiteOr(input);
        amount = std::clamp(finiteOr(amount), 0.0f, 1.0f);
        const auto feedback = 0.62f + 0.22f * amount;
        float tank = 0.0f;

        for (auto& comb : combs)
        {
            const auto delayed = comb.delay.read(comb.delaySamples);
            comb.damped += 0.32f * (delayed - comb.damped);
            comb.delay.push(input * 0.25f + comb.damped * feedback);
            tank += delayed;
        }

        tank *= 0.25f;
        for (auto& diffuser : diffusers)
        {
            const auto delayed = diffuser.delay.read(diffuser.delaySamples);
            constexpr float coefficient = 0.58f;
            const auto output = delayed - tank * coefficient;
            diffuser.delay.push(tank + delayed * coefficient);
            tank = output;
        }

        return finiteOr(tank);
    }

private:
    struct Comb
    {
        DelayLine delay;
        float delaySamples = 1.0f;
        float damped = 0.0f;
    };
    struct Diffuser
    {
        DelayLine delay;
        float delaySamples = 1.0f;
    };

    std::array<Comb, 4> combs;
    std::array<Diffuser, 2> diffusers;
};

struct Controls
{
    float channel = 0.0f;          // 0: Normal/Clean, 1: Vibrato/Dirty
    float input = 0.0f;            // 0: Input I, 1: Input II (-6 dB)
    float normalVolume = 5.5f;
    float vibratoDrive = 5.0f;
    float master = 6.0f;
    float bass = 5.0f;
    float middle = 5.0f;
    float treble = 5.0f;
    float reverb = 2.5f;
    float vibratoDepth = 0.0f;
    float vibratoRate = 4.0f;
    float bright = 0.0f;
    float vibratoOn = 0.0f;
};

class Deluxe65Engine
{
public:
    static constexpr double nominalPowerWatts = 22.0;
    static constexpr int powerTubeCount = 2;

    void prepare(double sampleRate)
    {
        rate = std::isfinite(sampleRate) && sampleRate >= 8000.0 && sampleRate <= 384000.0
            ? sampleRate : 44100.0;
        const auto channelRate = static_cast<float>(rate);
        bassCoefficient = coefficientFor(125.0f, channelRate);
        midLowCoefficient = coefficientFor(350.0f, channelRate);
        midHighCoefficient = coefficientFor(1200.0f, channelRate);
        highCoefficient = coefficientFor(2800.0f, channelRate);
        speakerCoefficient = coefficientFor(5600.0f, channelRate);
        highPassCoefficient = coefficientFor(55.0f, channelRate);
        sagAttack = coefficientFor(16.0f, channelRate);
        sagRelease = coefficientFor(4.0f, channelRate);

        for (std::size_t channel = 0; channel < channels.size(); ++channel)
        {
            channels[channel].vibrato.prepare(rate, channel == 0 ? 0.0f : 1.57079632679f);
            channels[channel].reverb.prepare(rate, static_cast<int>(channel));
            channels[channel].clearFilters();
        }
    }

    void reset() noexcept
    {
        for (auto& channel : channels)
        {
            channel.vibrato.reset();
            channel.reverb.reset();
            channel.clearFilters();
        }
    }

    float processSample(float input, int channelIndex, const Controls& controls) noexcept
    {
        input = finiteOr(input);
        auto& state = channels[static_cast<std::size_t>(std::clamp(channelIndex, 0, 1))];
        const auto channelMix = std::clamp(finiteOr(controls.channel), 0.0f, 1.0f);
        const auto inputTwo = std::clamp(finiteOr(controls.input), 0.0f, 1.0f);
        const auto inputGain = 1.0f - inputTwo * 0.4988128f;
        const auto source = input * inputGain;

        const auto normalVolume = std::clamp(finiteOr(controls.normalVolume), 0.0f, 10.0f);
        const auto normalDrive = 1.2f + normalVolume * 0.38f;
        // Keep the default 5.5 output level while allowing zero volume to mute.
        const auto clean = tubeStage(source, normalDrive, 0.045f) * (normalVolume / 5.5f);

        const auto dirtyGain = std::clamp(finiteOr(controls.vibratoDrive), 0.0f, 10.0f);
        auto dirty = tubeStage(source, 1.6f + dirtyGain * 0.83f, 0.075f);
        dirty = tubeStage(dirty, 1.15f + dirtyGain * 0.43f, 0.035f);
        auto signal = clean + (dirty - clean) * channelMix;

        const auto vibratoDepth = std::clamp(finiteOr(controls.vibratoDepth) / 10.0f, 0.0f, 1.0f);
        const auto vibrato = state.vibrato.process(signal, vibratoDepth,
                                                   std::clamp(finiteOr(controls.vibratoRate, 4.0f), 0.5f, 8.0f));
        const auto vibratoMix = channelMix * std::clamp(finiteOr(controls.vibratoOn), 0.0f, 1.0f);
        signal += (vibrato - signal) * vibratoMix;

        const auto reverbAmount = std::clamp(finiteOr(controls.reverb) / 10.0f, 0.0f, 1.0f);
        const auto wet = state.reverb.process(signal, reverbAmount);
        const auto reverbMix = channelMix * reverbAmount * 0.48f;
        signal += wet * reverbMix;

        const auto envelope = std::abs(signal);
        const auto envelopeCoefficient = envelope > state.sagEnvelope ? sagAttack : sagRelease;
        state.sagEnvelope += envelopeCoefficient * (envelope - state.sagEnvelope);
        const auto sag = 1.0f - 0.20f * std::clamp(state.sagEnvelope, 0.0f, 1.0f);
        const auto master = std::clamp(finiteOr(controls.master) / 10.0f, 0.0f, 1.0f);
        const auto powerDrive = 1.5f + master * 4.0f;
        const auto power = tubeStage(signal * sag, powerDrive, 0.025f);
        auto output = power * master;

        output = applyToneAndSpeaker(output, controls, state);
        return std::isfinite(output) ? std::clamp(output, -1.0f, 1.0f) : 0.0f;
    }

private:
    struct ChannelState
    {
        PitchVibrato vibrato;
        SpringReverb reverb;
        float sagEnvelope = 0.0f;
        float bassState = 0.0f;
        float midLowState = 0.0f;
        float midHighState = 0.0f;
        float highState = 0.0f;
        float speakerState = 0.0f;
        float highPassState = 0.0f;

        void clearFilters() noexcept
        {
            sagEnvelope = bassState = midLowState = midHighState = 0.0f;
            highState = speakerState = highPassState = 0.0f;
        }
    };

    static float coefficientFor(float frequency, float sampleRate) noexcept
    {
        return 1.0f - std::exp(-6.28318530717958647692f * frequency / sampleRate);
    }

    static float tubeStage(float input, float drive, float bias) noexcept
    {
        const auto safeDrive = std::clamp(finiteOr(drive, 1.0f), 0.1f, 32.0f);
        const auto safeInput = finiteOr(input);
        const auto offset = std::tanh(bias * safeDrive);
        const auto asymmetric = std::tanh(safeInput * safeDrive + bias * safeDrive) - offset;
        const auto symmetric = std::tanh(safeInput * safeDrive * 0.78f);
        return 0.58f * asymmetric + 0.42f * symmetric;
    }

    float applyToneAndSpeaker(float input, const Controls& controls, ChannelState& state) const noexcept
    {
        input = finiteOr(input);
        state.bassState += bassCoefficient * (input - state.bassState);
        state.midLowState += midLowCoefficient * (input - state.midLowState);
        state.midHighState += midHighCoefficient * (input - state.midHighState);
        state.highState += highCoefficient * (input - state.highState);

        const auto bass = std::clamp(finiteOr(controls.bass, 5.0f), 0.0f, 10.0f);
        const auto middle = std::clamp(finiteOr(controls.middle, 5.0f), 0.0f, 10.0f);
        const auto treble = std::clamp(finiteOr(controls.treble, 5.0f), 0.0f, 10.0f);
        const auto bright = std::clamp(finiteOr(controls.bright), 0.0f, 1.0f);

        auto equalized = input
            + state.bassState * ((bass - 5.0f) * 0.075f)
            + (state.midHighState - state.midLowState) * ((middle - 5.0f) * 0.12f)
            + (input - state.highState) * ((treble - 5.0f) * 0.075f + bright * 0.12f);

        state.speakerState += speakerCoefficient * (equalized - state.speakerState);
        state.highPassState += highPassCoefficient * (state.speakerState - state.highPassState);
        // Fixed Jensen C-12K-style band limiting: low-frequency cone rolloff and
        // a smooth top end, without loading an impulse response on the audio thread.
        return finiteOr(state.speakerState - state.highPassState);
    }

    std::array<ChannelState, 2> channels;
    double rate = 44100.0;
    float bassCoefficient = 0.0f;
    float midLowCoefficient = 0.0f;
    float midHighCoefficient = 0.0f;
    float highCoefficient = 0.0f;
    float speakerCoefficient = 0.0f;
    float highPassCoefficient = 0.0f;
    float sagAttack = 0.0f;
    float sagRelease = 0.0f;
};
}
