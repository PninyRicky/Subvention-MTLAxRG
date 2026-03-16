"use client";

import { Component, type ReactNode } from "react";

import { TerritoryMap } from "@/components/territory-map";
import type { TerritoryData } from "@/lib/territories";

type Props = {
  territory: TerritoryData;
};

type State = {
  hasError: boolean;
};

class TerritoryMapErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.hasError && previousProps.territory.label !== this.props.territory.label) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-[24px] border border-dashed border-black/12 bg-black/[0.02] px-4 py-6 text-sm leading-6 text-black/58">
          Une erreur est survenue dans la carte interactive. Les informations territoriales textuelles restent
          disponibles plus bas dans la fiche.
        </div>
      );
    }

    return <TerritoryMap territory={this.props.territory} />;
  }
}

export function SafeTerritoryMap({ territory }: Props) {
  const mapKey = `${territory.kind}:${territory.territoryCode ?? territory.name}:${territory.label}`;

  return <TerritoryMapErrorBoundary key={mapKey} territory={territory} />;
}
