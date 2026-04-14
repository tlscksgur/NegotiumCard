package com.negotium.card.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleIllegalArgument(IllegalArgumentException exception) {
        return new ErrorResponse(LocalDateTime.now(), exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.joining(", "));

        return new ErrorResponse(LocalDateTime.now(), message);
    }

    @ExceptionHandler(BadCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ErrorResponse handleBadCredentials(BadCredentialsException exception) {
        return new ErrorResponse(LocalDateTime.now(), "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ErrorResponse handleAuthentication(AuthenticationException exception) {
        return new ErrorResponse(LocalDateTime.now(), "인증 처리에 실패했습니다.");
    }

    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<ErrorResponse> handleRestClientResponse(RestClientResponseException exception) {
        String body = exception.getResponseBodyAsString();
        String message = body;

        if (body != null && body.contains("\"detail\"")) {
            int keyIndex = body.indexOf("\"detail\"");
            int colonIndex = body.indexOf(':', keyIndex);
            int firstQuote = body.indexOf('"', colonIndex + 1);
            int secondQuote = body.indexOf('"', firstQuote + 1);
            if (firstQuote >= 0 && secondQuote > firstQuote) {
                message = body.substring(firstQuote + 1, secondQuote);
            }
        }

        if (message == null || message.isBlank()) {
            message = "분석 서버 호출에 실패했습니다.";
        }

        return ResponseEntity.status(exception.getStatusCode())
            .body(new ErrorResponse(LocalDateTime.now(), message));
    }

    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<ErrorResponse> handleResourceAccess(ResourceAccessException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ErrorResponse(LocalDateTime.now(), "분석 서버에 연결할 수 없습니다."));
    }

    public record ErrorResponse(LocalDateTime timestamp, String message) {
    }
}
