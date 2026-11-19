import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {GH1StartCardScenario} from "./GH1StartCardScenario"
import {GH2DemoHoldScenario} from "./GH2DemoHoldScenario"
import {GH3DragSnapScenario} from "./GH3DragSnapScenario"
import {GH4OffPathScenario} from "./GH4OffPathScenario"
import {GH5RoundsScenario} from "./GH5RoundsScenario"
import {GH6RealDragStepsScenario} from "./GH6RealDragStepsScenario"
import {GH7ReplaySlowerScenario} from "./GH7ReplaySlowerScenario"
import {GH8FinishedKnotScenario} from "./GH8FinishedKnotScenario"
import {GH9GhostHandsPoseScenario} from "./GH9GhostHandsPoseScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "gh1-start-card", typename: GH1StartCardScenario.getTypeName()},
    {id: "gh2-demo-hold", typename: GH2DemoHoldScenario.getTypeName()},
    {id: "gh3-drag-snap", typename: GH3DragSnapScenario.getTypeName()},
    {id: "gh4-off-path", typename: GH4OffPathScenario.getTypeName()},
    {id: "gh5-tighten-rounds", typename: GH5RoundsScenario.getTypeName()},
    {id: "gh6-real-drag-steps", typename: GH6RealDragStepsScenario.getTypeName()},
    {id: "gh7-replay-slower", typename: GH7ReplaySlowerScenario.getTypeName()},
    {id: "gh8-finished-knot", typename: GH8FinishedKnotScenario.getTypeName()},
    {id: "gh9-ghost-hands-pose", typename: GH9GhostHandsPoseScenario.getTypeName()},
  ]
}
