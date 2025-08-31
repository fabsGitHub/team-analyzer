package com.teamanalyzer.teamanalyzer.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.teamanalyzer.teamanalyzer.domain.Evaluation;
import com.teamanalyzer.teamanalyzer.repo.EvaluationRepository;
import com.teamanalyzer.teamanalyzer.service.AggregationService;
import com.teamanalyzer.teamanalyzer.web.dto.AggregateDto;

import jakarta.validation.Valid;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class EvaluationController {
    private final EvaluationRepository repo;
    private final AggregationService agg;

    public EvaluationController(EvaluationRepository repo, AggregationService agg) {
        this.repo = repo;
        this.agg = agg;
    }

    @GetMapping("/evaluations")
    public List<Evaluation> all() {
        return repo.findAll();
    }

    @PostMapping("/evaluations")
    @Valid
    public ResponseEntity<Evaluation> create(@RequestBody Evaluation e) {
        var saved = repo.save(e);
        return ResponseEntity.created(URI.create("/api/evaluations/" + saved.getId())).body(saved);
    }

    @PutMapping("/evaluations/{id}")
    @Valid
    public ResponseEntity<Evaluation> update(@PathVariable UUID id, @RequestBody Evaluation patch) {
        return repo.findById(id).map(e -> {
            e.setName(patch.getName() != null ? patch.getName() : e.getName());
            if (patch.getTeam() != null)
                e.setTeam(patch.getTeam());
            if (patch.getAppreciation() != 0)
                e.setAppreciation(patch.getAppreciation());
            if (patch.getEquality() != 0)
                e.setEquality(patch.getEquality());
            if (patch.getWorkload() != 0)
                e.setWorkload(patch.getWorkload());
            if (patch.getCollegiality() != 0)
                e.setCollegiality(patch.getCollegiality());
            if (patch.getTransparency() != 0)
                e.setTransparency(patch.getTransparency());
            return ResponseEntity.ok(repo.save(e));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/evaluations/{id}")
    public ResponseEntity<Void> del(@PathVariable UUID id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/aggregates")
    public List<AggregateDto> aggregates() {
        return agg.aggregates();
    }
}
