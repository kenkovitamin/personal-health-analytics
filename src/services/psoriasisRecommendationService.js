// ==============================
// PSORIASIS RECOMMENDATIONS ENGINE
// Generates personalized recommendations based on PAI breakdown
// ==============================

export function generatePsoriasisRecommendations(paiData, userProfile) {
  const { breakdown } = paiData;
  const recommendations = {
    priority: [],
    diet: [],
    supplements: [],
    lifestyle: [],
    monitoring: [],
    triggers_to_avoid: []
  };

  // ==============================
  // INFLAMMATION-BASED RECOMMENDATIONS
  // ==============================
  if (breakdown.inflammation >= 7) {
    recommendations.priority.push({
      level: "HIGH",
      message: "High inflammation detected. Focus on anti-inflammatory interventions immediately."
    });
    
    recommendations.diet.push(
      "Follow strict anti-inflammatory diet (Mediterranean or AIP)",
      "Eliminate nightshades (tomatoes, peppers, eggplant, potatoes)",
      "Increase fatty fish intake (salmon, mackerel, sardines) 3x per week",
      "Add turmeric and ginger to daily meals"
    );
    
    recommendations.supplements.push(
      "Curcumin 500-1000mg daily (with black pepper for absorption)",
      "Omega-3 EPA/DHA 2000-3000mg daily",
      "Consider topical aloe vera for affected areas"
    );
    
    recommendations.triggers_to_avoid.push(
      "Complete alcohol elimination for 30 days",
      "Avoid processed foods and refined sugars",
      "Reduce red meat consumption"
    );
    
  } else if (breakdown.inflammation >= 4) {
    recommendations.priority.push({
      level: "MODERATE",
      message: "Moderate inflammation. Implement anti-inflammatory strategies."
    });
    
    recommendations.diet.push(
      "Focus on anti-inflammatory foods (berries, leafy greens, nuts)",
      "Limit processed foods and added sugars",
      "Consider Mediterranean diet pattern"
    );
    
    recommendations.supplements.push(
      "Omega-3 1000-2000mg daily",
      "Curcumin 500mg daily"
    );
  }

  // ==============================
  // IMMUNE-BASED RECOMMENDATIONS
  // ==============================
  if (breakdown.immune >= 5) {
    recommendations.priority.push({
      level: "HIGH",
      message: "Immune dysfunction markers detected. Address nutrient deficiencies."
    });
    
    recommendations.supplements.push(
      "Vitamin D3 5000 IU daily (test levels after 3 months)",
      "Zinc 30mg daily (with copper 2mg)",
      "Probiotics (10+ billion CFU) for immune modulation"
    );
    
    recommendations.monitoring.push(
      "Get comprehensive blood panel: Vitamin D, Zinc, CBC",
      "Retest Vitamin D in 3 months (target 50-70 ng/mL)",
      "Monitor for signs of infection (can trigger flares)"
    );
    
  } else if (breakdown.immune >= 3) {
    recommendations.supplements.push(
      "Vitamin D3 2000-4000 IU daily",
      "Zinc 15-30mg daily"
    );
    
    recommendations.monitoring.push(
      "Consider Vitamin D testing if not done recently"
    );
  }

  // ==============================
  // GUT-BASED RECOMMENDATIONS
  // ==============================
  if (breakdown.gut >= 5) {
    recommendations.priority.push({
      level: "MODERATE",
      message: "Gut health concerns. Focus on gut barrier repair and microbiome."
    });
    
    recommendations.diet.push(
      "Increase fiber intake to 30g+ daily (vegetables, fruits, legumes)",
      "Add fermented foods daily (sauerkraut, kimchi, kefir)",
      "Eliminate gluten for 4-6 weeks trial",
      "Consider dairy elimination trial (common trigger)",
      "Bone broth 2-3x per week for gut healing"
    );
    
    recommendations.supplements.push(
      "Multi-strain probiotic (Lactobacillus + Bifidobacterium)",
      "L-Glutamine 5g daily for gut barrier repair",
      "Digestive enzymes with meals"
    );
    
    recommendations.triggers_to_avoid.push(
      "Alcohol (damages gut lining)",
      "NSAIDs like ibuprofen (increase gut permeability)",
      "Artificial sweeteners"
    );
    
  } else if (breakdown.gut >= 3) {
    recommendations.diet.push(
      "Increase fiber-rich vegetables",
      "Add fermented foods 3-4x per week",
      "Stay well-hydrated (2+ liters water daily)"
    );
    
    recommendations.supplements.push(
      "Probiotic supplement or fermented foods daily"
    );
  }

  // ==============================
  // LIFESTYLE-BASED RECOMMENDATIONS
  // ==============================
  if (breakdown.lifestyle >= 5) {
    recommendations.priority.push({
      level: "MODERATE",
      message: "Lifestyle triggers identified. Address stress and environmental factors."
    });
    
    recommendations.lifestyle.push(
      "Implement daily stress management (meditation, yoga, breathing exercises)",
      "Prioritize 7-9 hours quality sleep",
      "Regular moderate exercise 30 min, 5x per week",
      "Keep detailed symptom-trigger journal for pattern identification"
    );
    
    // Smoking check
    if (userProfile?.lifestyle?.smoking) {
      recommendations.priority.unshift({
        level: "CRITICAL",
        message: "Smoking is a major psoriasis trigger. Cessation is the #1 priority."
      });
      
      recommendations.lifestyle.unshift(
        "URGENT: Start smoking cessation program immediately",
        "Consider nicotine replacement therapy",
        "Join support group or use cessation app"
      );
    }
    
    // Alcohol check
    if (userProfile?.lifestyle?.alcohol === "high") {
      recommendations.triggers_to_avoid.push(
        "Reduce alcohol to <2 drinks per week or eliminate completely"
      );
    }
    
    recommendations.lifestyle.push(
      "Moisturize affected areas 2-3x daily",
      "Avoid hot showers (use lukewarm water)",
      "Use fragrance-free, gentle skin products"
    );
    
  } else if (breakdown.lifestyle >= 2) {
    recommendations.lifestyle.push(
      "Maintain consistent sleep schedule",
      "Daily stress reduction practice (even 5-10 minutes)",
      "Keep skin well-moisturized"
    );
  }

  // ==============================
  // SYMPTOM SEVERITY-BASED
  // ==============================
  if (userProfile?.psoriasis?.body_surface_area >= 10) {
    recommendations.monitoring.push(
      "Consult dermatologist for systemic therapy evaluation (biologics, methotrexate)",
      "Consider phototherapy (UVB) treatment"
    );
  } else if (userProfile?.psoriasis?.body_surface_area >= 3) {
    recommendations.monitoring.push(
      "Regular dermatologist follow-up every 3 months",
      "Discuss topical treatment optimization"
    );
  }

  // ==============================
  // BASELINE RECOMMENDATIONS (always include)
  // ==============================
  recommendations.monitoring.push(
    "Track symptoms daily to identify personal triggers",
    "Photograph affected areas monthly to track progress"
  );

  return recommendations;
}
