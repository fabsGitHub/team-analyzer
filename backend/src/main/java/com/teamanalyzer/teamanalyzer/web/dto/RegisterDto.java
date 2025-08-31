package com.teamanalyzer.teamanalyzer.web.dto;

import jakarta.validation.constraints.Size;

public record RegisterDto(String email, @Size(min=10) String password) {
}
