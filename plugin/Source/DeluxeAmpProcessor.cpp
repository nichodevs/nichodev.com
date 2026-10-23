#include "DeluxeAmpProcessor.h"
#include "DeluxeAmpEditor.h"

namespace
{
using namespace deluxe65::parameterIds;

juce::NormalisableRange<float> dialRange()
{
    return {0.0f, 10.0f, 0.01f};
}

void resetSmoother(juce::SmoothedValue<float>& smoother, double sampleRate,
                   float currentValue)
{
    smoother.reset(sampleRate, 0.02);
    smoother.setCurrentAndTargetValue(currentValue);
}
}

Deluxe65AudioProcessor::Deluxe65AudioProcessor()
    : AudioProcessor(BusesProperties()
                         .withInput("Input", juce::AudioChannelSet::stereo(), true)
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      parameters(*this, nullptr, "DELUXE_65", createParameterLayout())
{
    raw.channel = parameters.getRawParameterValue(deluxe65::parameterIds::channel);
    raw.input = parameters.getRawParameterValue(deluxe65::parameterIds::input);
    raw.normalVolume = parameters.getRawParameterValue(normalVolume);
    raw.vibratoDrive = parameters.getRawParameterValue(vibratoDrive);
    raw.master = parameters.getRawParameterValue(master);
    raw.bass = parameters.getRawParameterValue(bass);
    raw.middle = parameters.getRawParameterValue(middle);
    raw.treble = parameters.getRawParameterValue(treble);
    raw.reverb = parameters.getRawParameterValue(reverb);
    raw.vibratoDepth = parameters.getRawParameterValue(vibratoDepth);
    raw.vibratoRate = parameters.getRawParameterValue(vibratoRate);
    raw.bright = parameters.getRawParameterValue(bright);
    raw.vibratoOn = parameters.getRawParameterValue(vibratoOn);
}

juce::AudioProcessorValueTreeState::ParameterLayout
Deluxe65AudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID{channel, 1}, "Channel",
        juce::StringArray{"Normal / Clean", "Vibrato / Dirty"}, 0));
    layout.add(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID{input, 1}, "Input",
        juce::StringArray{"Input I", "Input II (-6 dB)"}, 0));

    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{normalVolume, 1}, "Normal Volume", dialRange(), 5.5f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{vibratoDrive, 1}, "Vibrato Drive", dialRange(), 5.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{master, 1}, "Master", dialRange(), 6.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{bass, 1}, "Bass", dialRange(), 5.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{middle, 1}, "Middle", dialRange(), 5.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{treble, 1}, "Treble", dialRange(), 5.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{reverb, 1}, "Spring Reverb", dialRange(), 2.5f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{vibratoDepth, 1}, "Vibrato Depth", dialRange(), 0.0f));
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{vibratoRate, 1}, "Vibrato Rate", juce::NormalisableRange<float>{0.5f, 8.0f, 0.01f}, 4.0f, "Hz"));
    layout.add(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID{bright, 1}, "Bright", false));
    layout.add(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID{vibratoOn, 1}, "Pitch Vibrato", false));

    return layout;
}

void Deluxe65AudioProcessor::prepareToPlay(double sampleRate, int)
{
    const auto safeRate = std::isfinite(sampleRate) && sampleRate >= 8000.0 && sampleRate <= 384000.0
        ? sampleRate : 44100.0;
    engine.prepare(safeRate);

    resetSmoother(channelSmoother, safeRate, raw.channel->load());
    resetSmoother(inputSmoother, safeRate, raw.input->load());
    resetSmoother(normalVolumeSmoother, safeRate, raw.normalVolume->load());
    resetSmoother(vibratoDriveSmoother, safeRate, raw.vibratoDrive->load());
    resetSmoother(masterSmoother, safeRate, raw.master->load());
    resetSmoother(bassSmoother, safeRate, raw.bass->load());
    resetSmoother(middleSmoother, safeRate, raw.middle->load());
    resetSmoother(trebleSmoother, safeRate, raw.treble->load());
    resetSmoother(reverbSmoother, safeRate, raw.reverb->load());
    resetSmoother(vibratoDepthSmoother, safeRate, raw.vibratoDepth->load());
    resetSmoother(vibratoRateSmoother, safeRate, raw.vibratoRate->load());
    resetSmoother(brightSmoother, safeRate, raw.bright->load());
    resetSmoother(vibratoOnSmoother, safeRate, raw.vibratoOn->load());
}

void Deluxe65AudioProcessor::releaseResources()
{
    engine.reset();
}

bool Deluxe65AudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == layouts.getMainInputChannelSet()
        && (output == juce::AudioChannelSet::mono() || output == juce::AudioChannelSet::stereo());
}

void Deluxe65AudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    midi.clear();

    channelSmoother.setTargetValue(raw.channel->load());
    inputSmoother.setTargetValue(raw.input->load());
    normalVolumeSmoother.setTargetValue(raw.normalVolume->load());
    vibratoDriveSmoother.setTargetValue(raw.vibratoDrive->load());
    masterSmoother.setTargetValue(raw.master->load());
    bassSmoother.setTargetValue(raw.bass->load());
    middleSmoother.setTargetValue(raw.middle->load());
    trebleSmoother.setTargetValue(raw.treble->load());
    reverbSmoother.setTargetValue(raw.reverb->load());
    vibratoDepthSmoother.setTargetValue(raw.vibratoDepth->load());
    vibratoRateSmoother.setTargetValue(raw.vibratoRate->load());
    brightSmoother.setTargetValue(raw.bright->load());
    vibratoOnSmoother.setTargetValue(raw.vibratoOn->load());

    for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
    {
        deluxe65::dsp::Controls controls;
        controls.channel = channelSmoother.getNextValue();
        controls.input = inputSmoother.getNextValue();
        controls.normalVolume = normalVolumeSmoother.getNextValue();
        controls.vibratoDrive = vibratoDriveSmoother.getNextValue();
        controls.master = masterSmoother.getNextValue();
        controls.bass = bassSmoother.getNextValue();
        controls.middle = middleSmoother.getNextValue();
        controls.treble = trebleSmoother.getNextValue();
        controls.reverb = reverbSmoother.getNextValue();
        controls.vibratoDepth = vibratoDepthSmoother.getNextValue();
        controls.vibratoRate = vibratoRateSmoother.getNextValue();
        controls.bright = brightSmoother.getNextValue();
        controls.vibratoOn = vibratoOnSmoother.getNextValue();

        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
        {
            const auto output = engine.processSample(buffer.getSample(channel, sample), channel, controls);
            buffer.setSample(channel, sample, output);
        }
    }
}

juce::AudioProcessorEditor* Deluxe65AudioProcessor::createEditor()
{
    return new Deluxe65AudioProcessorEditor(*this);
}

void Deluxe65AudioProcessor::getStateInformation(juce::MemoryBlock& destination)
{
    if (const auto xml = parameters.copyState().createXml())
        copyXmlToBinary(*xml, destination);
}

void Deluxe65AudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    if (const auto xml = getXmlFromBinary(data, sizeInBytes);
        xml != nullptr && xml->hasTagName(parameters.state.getType()))
        parameters.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new Deluxe65AudioProcessor();
}
