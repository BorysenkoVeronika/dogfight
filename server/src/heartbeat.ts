export class Heartbeat {
  private missed = 0;
  pong(): void {this.missed=0;}
  ping(): boolean {if(this.missed>=2)return false;this.missed++;return true;}
  get missedPongs(){return this.missed;}
}
