package com.negotium.card.config;

import com.negotium.card.entity.User;
import com.negotium.card.entity.UserRole;
import com.negotium.card.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@ConditionalOnProperty(name = "app.auth.seed-default-user", havingValue = "true")
@RequiredArgsConstructor
public class DevAuthDataInitializer {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    CommandLineRunner devUserInitializer() {
        return args -> userRepository.findByEmail("tester@example.com")
            .orElseGet(() -> userRepository.save(User.builder()
                .name("테스트 사용자")
                .email("tester@example.com")
                .password(passwordEncoder.encode("password123"))
                .role(UserRole.USER)
                .build()));
    }
}
