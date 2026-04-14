package com.negotium.card;

import com.negotium.card.analyze.dto.OcrAnalyzeResponse;
import com.negotium.card.analyze.dto.YoloAnalyzeResponse;
import com.negotium.card.analyze.service.FastApiService;
import com.negotium.card.entity.Card;
import com.negotium.card.entity.CardStatus;
import com.negotium.card.entity.User;
import com.negotium.card.entity.UserRole;
import com.negotium.card.repository.CardRepository;
import com.negotium.card.repository.OcrResultRepository;
import com.negotium.card.repository.UserRepository;
import com.negotium.card.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpServerErrorException;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CardAnalyzeIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CardRepository cardRepository;

    @Autowired
    private OcrResultRepository ocrResultRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private FastApiService fastApiService;

    private String authorizationHeader;
    private Card uploadedCard;

    @BeforeEach
    void setUp() {
        User user = userRepository.save(User.builder()
            .name("테스트 사용자")
            .email("analyze@example.com")
            .password("encoded-password")
            .role(UserRole.USER)
            .build());

        uploadedCard = cardRepository.save(Card.builder()
            .user(user)
            .imageUrl("/api/v1/files/sample-card.jpeg")
            .originalFileName("sample-card.jpeg")
            .status(CardStatus.UPLOADED)
            .build());

        authorizationHeader = "Bearer " + jwtTokenProvider.createAccessToken(user.getEmail());
    }

    @Test
    void analyzeCardSucceedsEvenWhenYoloReturnsNoDetections() throws Exception {
        when(fastApiService.analyzeYolo(ArgumentMatchers.any()))
            .thenReturn(new YoloAnalyzeResponse(uploadedCard.getImageUrl(), List.of()));
        when(fastApiService.analyzeOcr(ArgumentMatchers.any()))
            .thenReturn(new OcrAnalyzeResponse(
                uploadedCard.getImageUrl(),
                "홍길동\n네고티움\n플랫폼팀\n리드 엔지니어\nhong@example.com\n010-1234-5678",
                "홍길동",
                "네고티움",
                "플랫폼팀",
                "리드 엔지니어",
                "hong@example.com",
                "010-1234-5678"
            ));

        mockMvc.perform(post("/api/v1/cards/{id}/analyze", uploadedCard.getId())
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ANALYZED"))
            .andExpect(jsonPath("$.ocrResult.name").value("홍길동"))
            .andExpect(jsonPath("$.ocrResult.company").value("네고티움"));

        Card savedCard = cardRepository.findById(uploadedCard.getId()).orElseThrow();
        assertThat(savedCard.getStatus()).isEqualTo(CardStatus.ANALYZED);
        assertThat(ocrResultRepository.findByCardId(uploadedCard.getId())).isPresent();
    }

    @Test
    void analyzeCardReturnsDownstreamStatusAndMarksCardFailedWhenOcrFails() throws Exception {
        when(fastApiService.analyzeYolo(ArgumentMatchers.any()))
            .thenReturn(new YoloAnalyzeResponse(uploadedCard.getImageUrl(), List.of()));
        when(fastApiService.analyzeOcr(ArgumentMatchers.any()))
            .thenThrow(HttpServerErrorException.create(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Service Unavailable",
                HttpHeaders.EMPTY,
                "{\"detail\":\"OCR 엔진을 사용할 수 없습니다.\"}".getBytes(StandardCharsets.UTF_8),
                StandardCharsets.UTF_8
            ));

        mockMvc.perform(post("/api/v1/cards/{id}/analyze", uploadedCard.getId())
                .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                .accept(MediaType.APPLICATION_JSON))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.message").value("OCR 엔진을 사용할 수 없습니다."));

        Card savedCard = cardRepository.findById(uploadedCard.getId()).orElseThrow();
        assertThat(savedCard.getStatus()).isEqualTo(CardStatus.FAILED);
    }
}
