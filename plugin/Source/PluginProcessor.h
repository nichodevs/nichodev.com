#pragma once
#include <JuceHeader.h>
#include <array>
#include <vector>

class NichodevGuitarFXAudioProcessor final : public juce::AudioProcessor
{
public:
    static constexpr int pedalCount = 15;
    static const std::array<const char*, pedalCount> ids;
    static const std::array<const char*, pedalCount> names;
    static const std::array<const char*, pedalCount> controls;
    NichodevGuitarFXAudioProcessor();
    ~NichodevGuitarFXAudioProcessor() override = default;
    void prepareToPlay(double, int) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout&) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 4.0; }
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;
    void movePedal(int, int);
    void applyPreset(const juce::String&);
    void resetGuitar();
    void randomizeGuitar();
    juce::AudioProcessorValueTreeState parameters;
private:
    struct State { std::vector<float> delay; int write=0; float env=0, smooth=1, filter=0, phase=0; };
    struct Params { std::atomic<float>* value=nullptr; std::atomic<float>* on=nullptr; };
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
    void restoreOrder();
    std::array<Params,pedalCount> pedalParams {};
    std::array<std::array<State,2>,pedalCount> fx {};
    std::array<float,2> ampFilter {};
    std::array<float,2> ampEnv {};
    std::array<std::atomic<int>,pedalCount> order {};
    std::atomic<float>* master=nullptr; std::atomic<float>* gain=nullptr; std::atomic<float>* tone=nullptr;
    double rate=44100.0;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(NichodevGuitarFXAudioProcessor)
};