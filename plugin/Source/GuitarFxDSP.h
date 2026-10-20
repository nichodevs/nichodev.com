#pragma once

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>

namespace guitarfx::dsp
{
constexpr bool needsDelayBuffer(int pedalIndex) noexcept
{
    return pedalIndex == 5 || pedalIndex == 6 || pedalIndex == 10
        || pedalIndex == 12 || pedalIndex == 13 || pedalIndex == 14;
}

inline std::size_t delayBufferLength(double sampleRate) noexcept
{
    return static_cast<std::size_t>(std::ceil(sampleRate * 0.75)) + 2;
}

inline float removeRectifierDc(float input, float& lowpass, float coefficient) noexcept
{
    const float rectified = std::abs(input);
    lowpass += coefficient * (rectified - lowpass);
    return rectified - lowpass;
}

template <std::size_t Size>
bool movePedal(std::array<int, Size>& order, int pedalId, int delta) noexcept
{
    if (pedalId < 0 || pedalId >= static_cast<int>(Size) || (delta != -1 && delta != 1))
        return false;

    const auto current = std::find(order.begin(), order.end(), pedalId);
    if (current == order.end())
        return false;

    const auto targetIndex = std::distance(order.begin(), current) + delta;
    if (targetIndex < 0 || targetIndex >= static_cast<std::ptrdiff_t>(Size))
        return false;

    std::iter_swap(current, order.begin() + targetIndex);
    return true;
}
}
