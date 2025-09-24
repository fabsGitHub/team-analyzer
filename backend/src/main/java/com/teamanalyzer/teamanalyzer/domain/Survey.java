package com.teamanalyzer.teamanalyzer.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "surveys")
public class Survey extends UuidEntity {
    @ManyToOne
    private Team team;
    @Column(columnDefinition = "BINARY(16)")
    private UUID createdBy; // user.id
    private String title;
    @OneToMany(mappedBy = "survey", cascade = jakarta.persistence.CascadeType.ALL, orphanRemoval = true)
    private List<SurveyQuestion> questions = new ArrayList<>();
}
