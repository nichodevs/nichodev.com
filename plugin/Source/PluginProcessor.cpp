#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
constexpr auto driveId = "drive";
constexpr auto toneId = "tone";
constexpr auto mixId = "mix";
constexpr auto outputId = "output";
}

NichodevGuitarFXAudioProcessor::NichodevGuitarFXAudioProcessor()
    : AudioProcessor(BusesProperties()
                         .withInput("Input", juce::AudioChannelSet::stereo(), true)
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      parameters(*this, nullptr, "PARAMETERS", createParameterLayout())
{
    driveParameter = parameters.getRawParameterValue(driveId);
    toneParameter = parameters.getRawParameterValue(toneId);
    mixParameter = parameters.getRawParameterValue(mixId);
    outputParameter = parameters.getRawParameterValue(outputId);
}

juce::AudioProcessorValueTreeState::ParameterLayout
NichodevGuitarFXAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { driveId, 1 }, "Drive",
        juce::NormalisableRange<float> { 0.0f, 1.0f, 0.001f }, 0.15f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { toneId, 1 }, "Tone",
        juce::NormalisableRange<float> { 0.0f, 1.0f, 0.001f }, 0.58f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { mixId, 1 }, "Mix",
        juce::NormalisableRange<float> { 0.0f, 1.0f, 0.001f }, 1.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { outputId, 1 }, "Output",
        juce::NormalisableRange<float> { -24.0f, 6.0f, 0.1f }, 0.0f, "dB"));
    return layout;
}

void NichodevGuitarFXAudioProcessor::prepareToPlay(double sampleRate, int)
{
    currentSampleRate = sampleRate;
    toneState.fill(0.0f);
}

void NichodevGuitarFXAudioProcessor::releaseResources()
{
    toneState.fill(0.0f);
}

bool NichodevGuitarFXAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    const auto input = layouts.getMainInputChannelSet();
    return input == output
        && (output == juce::AudioChannelSet::mono()
            || output == juce::AudioChannelSet::stereo());
}

void NichodevGuitarFXAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer,
                                                  juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    midiMessages.clear();

    const auto drive = driveParameter->load();
    const auto tone = toneParameter->load();
    const auto mix = mixParameter->load();
    const auto outputGain = juce::Decibels::decibelsToGain(outputParameter->load());

    const auto cutoffHz = 700.0f * std::pow(12500.0f / 700.0f, tone);
    const auto toneCoefficient = 1.0f - std::exp(
        -juce::MathConstants<float>::twoPi * cutoffHz
        / static_cast<float>(currentSampleRate));
    const auto driveGain = 1.0f + drive * 39.0f;

    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* samples = buffer.getWritePointer(channel);
        auto& filterState = toneState[static_cast<size_t>(channel)];

        for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
        {
            const auto dry = samples[sample];
            auto processed = dry;

            if (drive > 0.001f)
                processed = std::tanh(dry * driveGain);

            filterState += toneCoefficient * (processed - filterState);
            processed = filterState;

            const auto blended = dry + (processed - dry) * mix;
            samples[sample] = blended * outputGain;
        }
    }
}

juce::AudioProcessorEditor* NichodevGuitarFXAudioProcessor::createEditor()
{
    return new NichodevGuitarFXAudioProcessorEditor(*this);
}

void NichodevGuitarFXAudioProcessor::getStateInformation(juce::MemoryBlock& destinationData)
{
    const auto state = parameters.copyState();
    const auto xml = state.createXml();
    copyXmlToBinary(*xml, destinationData);
}

void NichodevGuitarFXAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    const auto xml = getXmlFromBinary(data, sizeInBytes);
    if (xml != nullptr && xml->hasTagName(parameters.state.getType()))
        parameters.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new NichodevGuitarFXAudioProcessor();
}
