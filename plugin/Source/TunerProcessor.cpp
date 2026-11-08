#include "TunerProcessor.h"
#include "TunerEditor.h"

BitunerAudioProcessor::BitunerAudioProcessor()
    : AudioProcessor(BusesProperties()
                         .withInput("Input", juce::AudioChannelSet::stereo(), true)
                         .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      parameters(*this, nullptr, "BITUNER", createParameterLayout())
{
    reference = parameters.getRawParameterValue("reference");
    mute = parameters.getRawParameterValue("mute");
}

BitunerAudioProcessor::~BitunerAudioProcessor() { analyser.stop(); }

juce::AudioProcessorValueTreeState::ParameterLayout BitunerAudioProcessor::createParameterLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    layout.add(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{"reference", 1}, "A4 Reference",
        juce::NormalisableRange<float>{430.0f, 450.0f, 1.0f}, 440.0f, "Hz"));
    layout.add(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID{"mute", 1}, "Mute Output", false));
    return layout;
}

void BitunerAudioProcessor::prepareToPlay(double rate, int)
{
    const auto safeRate = std::isfinite(rate) && rate >= 8000.0 && rate <= 384000.0 ? rate : 44100.0;
    outputGain.reset(safeRate, 0.01);
    outputGain.setCurrentAndTargetValue(isMuted() ? 0.0f : 1.0f);
    analyser.prepare(safeRate);
    setLatencySamples(0);
}

void BitunerAudioProcessor::releaseResources() { analyser.stop(); }

bool BitunerAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == layouts.getMainInputChannelSet()
        && (output == juce::AudioChannelSet::mono() || output == juce::AudioChannelSet::stereo());
}

void BitunerAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    midi.clear();
    // Choose the stronger input rather than summing stereo: inverted channels must not cancel.
    int analysisChannel = 0;
    double strongestEnergy = -1.0;
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* data = buffer.getWritePointer(channel);
        double energy = 0.0;
        for (int i = 0; i < buffer.getNumSamples(); ++i)
        {
            if (!std::isfinite(data[i]))
                data[i] = 0.0f;
            const auto value = static_cast<double>(data[i]);
            energy += value * value;
        }
        if (energy > strongestEnergy) { strongestEnergy = energy; analysisChannel = channel; }
    }
    if (buffer.getNumChannels() > 0)
        analyser.push(buffer.getReadPointer(analysisChannel), buffer.getNumSamples());

    outputGain.setTargetValue(isMuted() ? 0.0f : 1.0f);
    for (int i = 0; i < buffer.getNumSamples(); ++i)
    {
        const auto gain = outputGain.getNextValue();
        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
            buffer.getWritePointer(channel)[i] *= gain;
    }
}

void BitunerAudioProcessor::processBlockBypassed(juce::AudioBuffer<float>&, juce::MidiBuffer& midi)
{
    midi.clear();
    analyser.frequency.store(0.0f, std::memory_order_relaxed);
}

void BitunerAudioProcessor::AnalysisThread::prepare(double rate)
{
    stop();
    fifo.reset();
    detector.prepare(rate);
    discontinuity.store(false);
    active.store(startThread());
}

void BitunerAudioProcessor::AnalysisThread::stop()
{
    active.store(false);
    stopThread(-1);
    frequency.store(0.0f, std::memory_order_relaxed);
}

void BitunerAudioProcessor::AnalysisThread::push(const float* data, int count)
{
    if (!active.load())
        return;
    int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
    fifo.prepareToWrite(count, start1, size1, start2, size2);
    std::copy_n(data, size1, samples.begin() + start1);
    std::copy_n(data + size1, size2, samples.begin() + start2);
    if (size1 + size2 < count)
        discontinuity.store(true);
    fifo.finishedWrite(size1 + size2);
}

void BitunerAudioProcessor::AnalysisThread::run()
{
    auto lastInput = juce::Time::getMillisecondCounter();
    while (!threadShouldExit())
    {
        if (discontinuity.exchange(false))
        {
            detector.reset();
            frequency.store(0.0f, std::memory_order_relaxed);
        }
        int start1 = 0, size1 = 0, start2 = 0, size2 = 0;
        fifo.prepareToRead(2048, start1, size1, start2, size2);
        for (int part = 0; part < 2; ++part)
        {
            const auto start = part == 0 ? start1 : start2;
            const auto size = part == 0 ? size1 : size2;
            for (int i = 0; i < size; ++i)
                if (detector.push(samples[static_cast<std::size_t>(start + i)]))
                    frequency.store(detector.getFrequency(), std::memory_order_relaxed);
        }
        fifo.finishedRead(size1 + size2);
        if (size1 + size2 > 0)
            lastInput = juce::Time::getMillisecondCounter();
        else
        {
            if (juce::Time::getMillisecondCounter() - lastInput > 250)
            {
                detector.reset();
                frequency.store(0.0f, std::memory_order_relaxed);
            }
            wait(5);
        }
    }
}

juce::AudioProcessorEditor* BitunerAudioProcessor::createEditor() { return new BitunerEditor(*this); }

void BitunerAudioProcessor::getStateInformation(juce::MemoryBlock& destination)
{
    if (const auto xml = parameters.copyState().createXml())
        copyXmlToBinary(*xml, destination);
}

void BitunerAudioProcessor::setStateInformation(const void* data, int size)
{
    if (const auto xml = getXmlFromBinary(data, size);
        xml != nullptr && xml->hasTagName(parameters.state.getType()))
        parameters.replaceState(juce::ValueTree::fromXml(*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new BitunerAudioProcessor(); }
