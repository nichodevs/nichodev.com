cmake_minimum_required(VERSION 3.22)

project(NichodevGuitarFX VERSION 0.1.0 LANGUAGES CXX)

include(FetchContent)
set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 9.0.4
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(NichodevGuitarFX
  COMPANY_NAME "Nichodev"
  BUNDLE_ID com.nichodev.guitarfx
  PLUGIN_MANUFACTURER_CODE NCHD
  PLUGIN_CODE NGFX
  FORMATS VST3
  PRODUCT_NAME "Nichodev Guitar FX"
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT FALSE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD FALSE
  VST3_CATEGORIES Fx Distortion
)

juce_generate_juce_header(NichodevGuitarFX)

target_sources(NichodevGuitarFX PRIVATE
  Source/PluginProcessor.cpp
  Source/PluginEditor.cpp
)

target_compile_features(NichodevGuitarFX PRIVATE cxx_std_17)

target_compile_definitions(NichodevGuitarFX
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
)

target_link_libraries(NichodevGuitarFX
  PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)
