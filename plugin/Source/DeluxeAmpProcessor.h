#pragma once

#include <JuceHeader.h>
#include "DeluxeAmpDSP.h"

namespace deluxe65::parameterIds
{
inline constexpr char channel[] = "channel";
inline constexpr char input[] = "input";
inline constexpr char normalVolume[] = "normalVolume";
inline constexpr char vibratoDrive[] = "vibratoDrive";
inline constexpr char master[] = "master";
inline constexpr char bass[] = "bass";
inline constexpr char middle[] = "middle";
inline constexpr char treble[] = "treble";
inline constexpr char reverb[] = "reverb";
inline constexpr char vibratoDepth[] = "vibratoDepth";
inline constexpr char vibratoRate[] = "vibratoRate";
inline constexpr char bright[] = "bright";
inline constexpr char vibratoOn[] = "vibratoOn";
}

class Deluxe65AudioProcessor final : public juce::AudioProcessor
{
public:
    Deluxe65AudioProcessor();
    ~Deluxe65AudioProcessor() override = default;

    void prepareToPlay(double sampleRate, int maximumExpectedSamplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 4.5; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock& destination) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState parameters;

private:
    struct ParameterPointers
    {
        std::atomic<float>* channel = nullptr;
        std::atomic<float>* input = nullptr;
        std::atomic<float>* normalVolume = nullptr;
        std::atomic<float>* vibratoDrive = nullptr;
        std::atomic<float>* master = nullptr;
        std::atomic<float>* bass = nullptr;
        std::atomic<float>* middle = nullptr;
        std::atomic<float>* treble = nullptr;
        std::atomic<float>* reverb = nullptr;
        std::atomic<float>* vibratoDepth = nullptr;
        std::atomic<float>* vibratoRate = nullptr;
        std::atomic<float>* bright = nullptr;
        std::atomic<float>* vibratoOn = nullptr;
    } raw;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    deluxe65::dsp::Deluxe65Engine engine;
    juce::SmoothedValue<float> channelSmoother;
    juce::SmoothedValue<float> inputSmoother;
    juce::SmoothedValue<float> normalVolumeSmoother;
    juce::SmoothedValue<float> vibratoDriveSmoother;
    juce::SmoothedValue<float> masterSmoother;
    juce::SmoothedValue<float> bassSmoother;
    juce::SmoothedValue<float> middleSmoother;
    juce::SmoothedValue<float> trebleSmoother;
    juce::SmoothedValue<float> reverbSmoother;
    juce::SmoothedValue<float> vibratoDepthSmoother;
    juce::SmoothedValue<float> vibratoRateSmoother;
    juce::SmoothedValue<float> brightSmoother;
    juce::SmoothedValue<float> vibratoOnSmoother;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(Deluxe65AudioProcessor)
};
