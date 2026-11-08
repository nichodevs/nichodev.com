cmake_minimum_required(VERSION 3.22)

project(NichodevVST3Suite VERSION 0.3.0 LANGUAGES C CXX)

set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "" FORCE)
set(JUCE_LOCAL_PATH "" CACHE PATH "Caminho para a pasta local do JUCE")

if(JUCE_LOCAL_PATH)
  if(NOT EXISTS "${JUCE_LOCAL_PATH}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE_LOCAL_PATH deve apontar para a pasta raiz do JUCE.")
  endif()
  add_subdirectory("${JUCE_LOCAL_PATH}" "${CMAKE_BINARY_DIR}/JUCE")
else()
  include(FetchContent)
  FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 9.0.4
    GIT_SHALLOW TRUE
  )
  FetchContent_MakeAvailable(JUCE)
endif()

juce_add_plugin(NichodevGuitarFX
  VERSION 0.1.8
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

juce_add_plugin(NichodevDeluxe65
  VERSION 0.1.2
  COMPANY_NAME "Nichodev"
  BUNDLE_ID com.nichodev.deluxe65
  PLUGIN_MANUFACTURER_CODE NCHD
  PLUGIN_CODE NDA5
  FORMATS VST3
  PRODUCT_NAME "Nichodev Deluxe 65 Amp"
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT FALSE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD FALSE
  VST3_CATEGORIES Fx Distortion Reverb Modulation
)

juce_add_plugin(Nichodev8bituner
  VERSION 0.1.0
  COMPANY_NAME "Nichodev"
  BUNDLE_ID com.nichodev.8bituner
  PLUGIN_MANUFACTURER_CODE NCHD
  PLUGIN_CODE N8tu
  FORMATS VST3
  PRODUCT_NAME "8bituner"
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT FALSE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD FALSE
  VST3_CATEGORIES Fx Analyzer
)

juce_generate_juce_header(NichodevGuitarFX)
juce_generate_juce_header(NichodevDeluxe65)
juce_generate_juce_header(Nichodev8bituner)

juce_add_binary_data(NichodevVST3SuiteAssets
  SOURCES
    Assets/Pixel.ttf
    Assets/OFL.txt
)

target_sources(NichodevGuitarFX PRIVATE
  Source/PluginProcessor.cpp
  Source/PluginEditor.cpp
)

target_sources(NichodevDeluxe65 PRIVATE
  Source/DeluxeAmpProcessor.cpp
  Source/DeluxeAmpEditor.cpp
)

target_sources(Nichodev8bituner PRIVATE Source/TunerProcessor.cpp Source/TunerEditor.cpp)
target_compile_features(Nichodev8bituner PRIVATE cxx_std_17)
target_compile_definitions(Nichodev8bituner PRIVATE
  JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0
)
target_link_libraries(Nichodev8bituner PRIVATE
  NichodevVST3SuiteAssets
  juce::juce_audio_utils
  juce::juce_recommended_config_flags
  juce::juce_recommended_lto_flags
  juce::juce_recommended_warning_flags
)

target_compile_features(NichodevGuitarFX PRIVATE cxx_std_17)
target_compile_features(NichodevDeluxe65 PRIVATE cxx_std_17)

target_compile_definitions(NichodevGuitarFX
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_compile_definitions(NichodevDeluxe65
  PRIVATE
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(NichodevGuitarFX
  PRIVATE
    NichodevVST3SuiteAssets
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

target_link_libraries(NichodevDeluxe65
  PRIVATE
    NichodevVST3SuiteAssets
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)


include(CTest)
if(BUILD_TESTING)
  add_executable(Nichodev8bitunerDSPTests tests/tuner_dsp_tests.cpp)
  target_include_directories(Nichodev8bitunerDSPTests PRIVATE Source)
  target_compile_features(Nichodev8bitunerDSPTests PRIVATE cxx_std_17)
  add_test(NAME Nichodev8bitunerDSPTests COMMAND Nichodev8bitunerDSPTests)

  juce_add_console_app(Nichodev8bitunerHostTests PRODUCT_NAME "8bituner host tests")
  target_sources(Nichodev8bitunerHostTests PRIVATE tests/tuner_host_tests.cpp)
  target_compile_features(Nichodev8bitunerHostTests PRIVATE cxx_std_17)
  target_compile_definitions(Nichodev8bitunerHostTests PRIVATE
    JUCE_PLUGINHOST_VST3=1 JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_MODAL_LOOPS_PERMITTED=1
  )
  target_link_libraries(Nichodev8bitunerHostTests PRIVATE juce::juce_audio_utils juce::juce_recommended_config_flags)
  add_dependencies(Nichodev8bitunerHostTests Nichodev8bituner_VST3)
  set(tuner_bundle "${CMAKE_BINARY_DIR}/Nichodev8bituner_artefacts/$<CONFIG>/VST3/8bituner.vst3")
  if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    add_test(NAME Nichodev8bitunerHostTests COMMAND xvfb-run -a $<TARGET_FILE:Nichodev8bitunerHostTests>
      "${tuner_bundle}" "${CMAKE_BINARY_DIR}/8bituner-preview.png")
  else()
    add_test(NAME Nichodev8bitunerHostTests COMMAND Nichodev8bitunerHostTests
      "${tuner_bundle}" "${CMAKE_BINARY_DIR}/8bituner-preview.png")
  endif()
  set_tests_properties(Nichodev8bitunerHostTests PROPERTIES TIMEOUT 90)

  add_executable(NichodevGuitarFXDSPTests tests/dsp_tests.cpp)
  target_include_directories(NichodevGuitarFXDSPTests PRIVATE Source)
  target_compile_features(NichodevGuitarFXDSPTests PRIVATE cxx_std_17)
  add_test(NAME NichodevGuitarFXDSPTests COMMAND NichodevGuitarFXDSPTests)

  add_executable(NichodevDeluxe65DSPTests tests/deluxe_amp_tests.cpp)
  target_include_directories(NichodevDeluxe65DSPTests PRIVATE Source)
  target_compile_features(NichodevDeluxe65DSPTests PRIVATE cxx_std_17)
  add_test(NAME NichodevDeluxe65DSPTests COMMAND NichodevDeluxe65DSPTests)

  add_executable(NichodevGuitarFXProcessorTests tests/processor_tests.cpp)
  target_include_directories(NichodevGuitarFXProcessorTests PRIVATE
    Source
    $<TARGET_PROPERTY:NichodevGuitarFX,INCLUDE_DIRECTORIES>
  )
  target_compile_definitions(NichodevGuitarFXProcessorTests PRIVATE
    $<TARGET_PROPERTY:NichodevGuitarFX,COMPILE_DEFINITIONS>
  )
  target_compile_features(NichodevGuitarFXProcessorTests PRIVATE cxx_std_17)
  target_link_libraries(NichodevGuitarFXProcessorTests PRIVATE NichodevGuitarFX)
  add_test(NAME NichodevGuitarFXProcessorTests COMMAND NichodevGuitarFXProcessorTests)
endif()
