package com.teamanalyzer.teamanalyzer.service;

import org.springframework.stereotype.Service;

import com.teamanalyzer.teamanalyzer.repo.EvaluationRepository;
import com.teamanalyzer.teamanalyzer.web.dto.AggregateDto;

import java.util.List;

@Service
public class AggregationService {
    private final EvaluationRepository repo;

    public AggregationService(EvaluationRepository repo) {
        this.repo = repo;
    }

    public List<AggregateDto> aggregates() {
        return repo.aggregates().stream().map(r -> new AggregateDto(
                (String) r[0], ((Number) r[1]).longValue(),
                ((Number) r[2]).doubleValue(), ((Number) r[3]).doubleValue(), ((Number) r[4]).doubleValue(),
                ((Number) r[5]).doubleValue(), ((Number) r[6]).doubleValue())).toList();
    }
}
