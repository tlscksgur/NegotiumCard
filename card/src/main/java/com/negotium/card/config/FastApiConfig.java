package com.negotium.card.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(FastApiProperties.class)
public class FastApiConfig {

    @Bean
    public RestClient fastApiRestClient(FastApiProperties properties) {
        return RestClient.builder()
            .baseUrl(properties.getBaseUrl())
            .build();
    }
}
