package com.negotium.card.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.fastapi")
public class FastApiProperties {

    private String baseUrl;
}
