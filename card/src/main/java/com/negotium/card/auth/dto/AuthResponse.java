package com.negotium.card.auth.dto;

public record AuthResponse(
    Long userId,
    String name,
    String email,
    String accessToken,
    String refreshToken
) {
}
