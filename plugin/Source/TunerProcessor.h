#pragma once

#include <JuceHeader.h>
#include "TunerDSP.h"

class BitunerAudioProcessor final : public juce::AudioProcessor
{
public:
    BitunerAudioProcessor();
    ~BitunerAudioProcessor() override;
    void prepareToPlay(double, int) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout&) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    void processBlockBypassed(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;
    float getDetectedFrequency() const { return analyser.frequency.load(std::memory_order_relaxed); }
    float getReference() const { return reference->load(); }
    bool isMuted() const { return mute->load() >= 0.5f; }

    juce::AudioProcessorValueTreeState parameters;

private:
    class AnalysisThread final : public juce::Thread
    {
    public:
        AnalysisThread() : Thread("8bituner analysis") {}
        ~AnalysisThread() override { stop(); }
        void prepare(double);
        void stop();
        void push(const float*, int);
        void run() override;
        std::atomic<float> frequency{0.0f};
    private:
        static constexpr int capacity = 32768;
        std::array<float, capacity> samples{};
        juce::AbstractFifo fifo{capacity};
        bituner::PitchDetector detector;
        std::atomic<bool> active{false}, discontinuity{false};
    } analyser;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
    std::atomic<float>* reference = nullptr;
    std::atomic<float>* mute = nullptr;
    juce::SmoothedValue<float> outputGain;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(BitunerAudioProcessor)
};
