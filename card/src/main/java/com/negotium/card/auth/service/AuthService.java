package com.negotium.card.auth.service;

import com.negotium.card.auth.dto.AuthResponse;
import com.negotium.card.auth.dto.LoginRequest;
import com.negotium.card.auth.dto.SignupRequest;
import com.negotium.card.entity.User;
import com.negotium.card.entity.UserRole;
import com.negotium.card.repository.UserRepository;
import com.negotium.card.security.SecurityUser;
import com.negotium.card.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email is already in use.");
        }

        User user = userRepository.save(User.builder()
            .name(request.name())
            .email(request.email())
            .password(passwordEncoder.encode(request.password()))
            .role(UserRole.USER)
            .build());

        Authentication authentication = new UsernamePasswordAuthenticationToken(user.getEmail(), request.password());
        Authentication authenticated = authenticationManager.authenticate(authentication);

        return buildResponse(user, authenticated);
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password())
        );

        SecurityUser securityUser = (SecurityUser) authentication.getPrincipal();
        User user = userRepository.findById(securityUser.getId())
            .orElseThrow(() -> new IllegalArgumentException("User not found."));

        return buildResponse(user, authentication);
    }

    private AuthResponse buildResponse(User user, Authentication authentication) {
        return new AuthResponse(
            user.getId(),
            user.getName(),
            user.getEmail(),
            jwtTokenProvider.createAccessToken(authentication),
            jwtTokenProvider.createRefreshToken(authentication)
        );
    }
}
