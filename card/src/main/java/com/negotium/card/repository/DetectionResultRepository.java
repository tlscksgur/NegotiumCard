package com.negotium.card.repository;

import com.negotium.card.entity.DetectionResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DetectionResultRepository extends JpaRepository<DetectionResult, Long> {

    List<DetectionResult> findByCardId(Long cardId);
}
