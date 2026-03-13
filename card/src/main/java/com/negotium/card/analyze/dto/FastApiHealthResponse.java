package com.negotium.card.analyze.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FastApiHealthResponse(
    String status,
    String service
) {
}
