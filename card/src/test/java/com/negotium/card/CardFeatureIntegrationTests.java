package com.negotium.card;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.negotium.card.entity.User;
import com.negotium.card.entity.UserRole;
import com.negotium.card.repository.UserRepository;
import com.negotium.card.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CardFeatureIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    private String authorizationHeader;

    @BeforeEach
    void setUp() {
        User user = userRepository.save(User.builder()
            .name("Tester")
            .email("tester@example.com")
            .password("encoded-password")
            .role(UserRole.USER)
            .build());
        authorizationHeader = "Bearer " + jwtTokenProvider.createAccessToken(user.getEmail());
    }

    @Test
    void manualCardCrudSearchAndOrganizationFlowWorks() throws Exception {
        String responseBody = mockMvc.perform(post("/api/v1/cards/manual")
                .header("Authorization", authorizationHeader)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "originalFileName", "manual-entry",
                    "name", "Kim Developer",
                    "company", "Negotium Labs",
                    "department", "Platform/Backend",
                    "position", "Lead Engineer",
                    "email", "kim@negotium.dev",
                    "phone", "010-1234-5678"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.ocrResult.name").value("Kim Developer"))
            .andExpect(jsonPath("$.ocrResult.company").value("Negotium Labs"))
            .andExpect(jsonPath("$.person.companyName").value("Negotium Labs"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        long cardId = objectMapper.readTree(responseBody).path("id").asLong();

        mockMvc.perform(get("/api/v1/search/persons")
                .header("Authorization", authorizationHeader)
                .param("name", "Kim")
                .param("company", "Negotium"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].departmentName").value("Backend"));

        String companiesResponse = mockMvc.perform(get("/api/v1/companies")
                .header("Authorization", authorizationHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Negotium Labs"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        long companyId = objectMapper.readTree(companiesResponse).get(0).path("id").asLong();

        mockMvc.perform(get("/api/v1/companies/{id}/tree", companyId)
                .header("Authorization", authorizationHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.companyName").value("Negotium Labs"))
            .andExpect(jsonPath("$.departments[0].name").value("Platform"))
            .andExpect(jsonPath("$.departments[0].children[0].name").value("Backend"))
            .andExpect(jsonPath("$.departments[0].children[0].persons[0].name").value("Kim Developer"));

        mockMvc.perform(delete("/api/v1/cards/{id}", cardId)
                .header("Authorization", authorizationHeader))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/cards")
                .header("Authorization", authorizationHeader))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void signupAndLoginReturnTokens() throws Exception {
        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "name", "테스트 사용자",
                    "email", "signup@example.com",
                    "password", "password123"
                ))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.email").value("signup@example.com"))
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty());

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "email", "signup@example.com",
                    "password", "password123"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("signup@example.com"))
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    @Test
    void invalidLoginReturnsUnauthorizedWithMessage() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "email", "missing@example.com",
                    "password", "wrongpass"
                ))))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."));
    }

    @Test
    void imageUploadRequiresAuthenticationWithUnauthorizedStatus() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "card.png",
            MediaType.IMAGE_PNG_VALUE,
            "fake-image".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/cards/image").file(file))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedImageUploadCreatesCard() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "card.png",
            MediaType.IMAGE_PNG_VALUE,
            "fake-image".getBytes()
        );

        mockMvc.perform(multipart("/api/v1/cards/image")
                .file(file)
                .header("Authorization", authorizationHeader))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.imageUrl").value(org.hamcrest.Matchers.startsWith("/api/v1/files/")))
            .andExpect(jsonPath("$.originalFileName").value("card.png"))
            .andExpect(jsonPath("$.status").value("UPLOADED"));
    }
}
