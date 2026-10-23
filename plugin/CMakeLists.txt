cmake_minimum_required(VERSION 3.22)

project(NichodevGuitarFX VERSION 0.1.6 LANGUAGES C CXX)

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

juce_add_binary_data(NichodevGuitarFXAssets
  SOURCES
    Assets/Pixel.ttf
    Assets/OFL.txt
)

target_sources(NichodevGuitarFX PRIVATE
  Source/PluginProcessor.cpp
  Source/PluginEditor.cpp
)

target_compile_features(NichodevGuitarFX PRIVATE cxx_std_17)

target_compile_definitions(NichodevGuitarFX
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(NichodevGuitarFX
  PRIVATE
    NichodevGuitarFXAssets
    juce::juce_audio_utils
    juce::juce_dsp
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)


include(CTest)
if(BUILD_TESTING)
  add_executable(NichodevGuitarFXDSPTests tests/dsp_tests.cpp)
  target_include_directories(NichodevGuitarFXDSPTests PRIVATE Source)
  target_compile_features(NichodevGuitarFXDSPTests PRIVATE cxx_std_17)
  add_test(NAME NichodevGuitarFXDSPTests COMMAND NichodevGuitarFXDSPTests)

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
