import { action, extendObservable, computed } from 'mobx';
import TheHero from './characters/TheHero';
import { firstRoom, createDungeon, placeWalls} from './DungeonGenerator';
import { crossTarget, hide, confirmClick } from './animation';
import FinalBoss from './characters/finalBoss';
import weapons from './characters/weapons';
const arrOfKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
                   'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];


const chop = (num) => Math.ceil(num / 2);

export class MainStore {
  constructor() {
    extendObservable(this, {
      //observerables for the main game
      hero: TheHero,
      boss: FinalBoss,
      grid: [],
      portalRoom: {},
      xPos: 0,
      yPos: 0,
      previousTile:{ x: 0, y: 0 },
      gameLevel: 1,
      noReset: true,
      gameStart: false,
      playingMusic: false,
      playerLevel: computed(() => {
        let exp = this.hero.exp;
        let level=1;
        while (exp >= 100) {
          exp -= (level * 100);
          if (exp >= 0) level++;
        }
        return level;
      }),

      expTillNext: computed(() => {
        let total = 0;
        for (let i = 1; i <= this.playerLevel; i++) {
          total += (i * 100);
        }
        return total - this.hero.exp;
      }),

      levelUp: action((level) => {
        if (level < this.playerLevel){
          this.hero.health = 50 + (this.playerLevel * 50);
          this.hero.totalHealth = 50 + (this.playerLevel * 50);
        }
      }),

      makeCurrentDungeon: action(() => {
        const currentDungeon = createDungeon();
        this.grid = currentDungeon.grid;
        this.portalRoom = currentDungeon.portalRoom;
      }),

      trackPosition: action(() => {
        window.addEventListener('keydown', (e) => {
          e.preventDefault();
          if(e.keyCode < 37 || e.keyCode > 40) {
            this.recievePlayerInput(e.keyCode);
          }
          this.previousTile = { y: this.yPos, x: this.xPos };
            switch (e.keyCode) {
              case 37:
                if (this.checkNextTile(this.grid[this.yPos][this.xPos-1])) this.xPos -= 1;
                break;
              case 38:
                if (this.checkNextTile(this.grid[this.yPos-1][this.xPos])) this.yPos -= 1;
                break;
              case 39:
                if (this.checkNextTile(this.grid[this.yPos][this.xPos+1])) this.xPos += 1;
                break;
              case 40:
                if (this.checkNextTile(this.grid[this.yPos+1][this.xPos])) this.yPos += 1;
                break;
              default:
                break;
            }
            this.moveCharacter();
        })
      }),

      checkNextTile: action((nextTile) => {
        switch (nextTile.type) {
          case 'floor':
            return true;
          case "Mygo":
          case "Abomination":
          case "Skraw":
          case "ArachnaDemos":
            return this.fightMonster(nextTile);
          case 'Boss':
          case 'BossArea':
            this.fightBoss();
            break;
          case 'health':
            return this.pickUpHealth(nextTile.healthAmt);
          case 'weapon':
            return this.pickUpWeapon(nextTile.weapon);
          case 'portal':
            this.handlePortal();
            break;
          default:
            break;
        }
      }),

      handlePortal: action(() => {
        this.playSound('portal');
        this.gameLevel++;
        this.compiledCreation();
      }),

      pickUpWeapon:action((weapon) => {
        this.playSound('pickUpSword');
        this.hero.currentWeapon = weapon.name;
        this.hero.atk = (this.playerLevel * 10) + weapon.atkUp;
        return true;
      }),

      playSound: action((id) => {
        let s = document.getElementById(id);
        s.load();
        s.play();
        if (id === 'Song') s.loop = true;
      }),

      syncStoreWithPos: action(() => {
        this.grid[this.yPos][this.xPos].hidden = true;
        this.xPos = firstRoom.x;
        this.yPos = firstRoom.y;
        this.grid[0][0] = { type: 'cell' };
      }),

      pickUpHealth: action((healthAmt) => {
        this.playSound('health');
        if (this.hero.health < this.hero.totalHealth) this.hero.health += healthAmt;
        return true;
      }),

      placePortal: action(() => {
        if (this.portalRoom === undefined) {
          this.compiledCreation();
          return null;
        }
        const { x, y, width, height } = this.portalRoom;
        let finalX = x + (chop(width) - 1);
        let finalY = y - (chop(height) - height);
        this.grid[finalY][finalX] = { type: 'portal', hidden: true };
      }),

      placeBossRoom: action(() => {
        this.playSound('cthuluWarn');
        if (this.portalRoom === undefined) {
          this.compiledCreation();
          return null;
        }
        const { x, y, width, height } = this.portalRoom;
        const { BossHeight, BossWidth, monsterClass } = FinalBoss;
        this.prepareBossRoom(x, y, width, height);
        let finalX = x + (chop(width)) - 2;
        let finalY = y - (chop(height) - height);
        for (let i = finalY; i < BossHeight + finalY; i++) {
          for (let j = finalX; j < BossWidth + finalX; j++) {
            this.grid[i][j] = { type: 'BossArea', monsterClass: monsterClass, hidden: true }
          }
        }
        this.grid[finalY][finalX] = {type: 'Boss', monsterClass: monsterClass, hidden: true}
      }),
      prepareBossRoom: action((x, y, width, height) => {
        for (let i = y; i < y + height + 2; i++){
          for (let j = x; j < x + width + 2; j++){
            placeWalls(this.grid, i , j);
            this.grid[i][j] = {type: 'floor', id: 'P', hidden: true };
          }
        }
      }),

      moveCharacter: action(() => {
        if (this.hero.health <= 0) {
          this.resetGame();
        } else {
          this.playSound('walk');
          const {x, y} = this.previousTile;
          this.grid[this.yPos][this.xPos] = { type: "hero"};
          this.shineLight();
          if ((this.xPos !== x || this.yPos !== y)) this.grid[y][x] = { type: 'floor' };
        }
      }),

      shineLight: action(() => {
        for (let i = 0; i < 2; i++ ) {
          this.grid[this.yPos + i][this.xPos].hidden = false;
          this.grid[this.yPos][this.xPos + i].hidden = false;
          this.grid[this.yPos - i][this.xPos].hidden = false;
          this.grid[this.yPos][this.xPos - i].hidden = false;
          this.grid[this.yPos + i][this.xPos + i].hidden = false;
          this.grid[this.yPos - i][this.xPos - i].hidden = false;
          this.grid[this.yPos - i][this.xPos + i].hidden = false;
          this.grid[this.yPos + i][this.xPos - i].hidden = false;
        }
      }),

      fightMonster: action((tile) => {
          const oldLevel = this.playerLevel;
          const monster = tile.monsterClass;
          let baseDamage = monster.atk + (5 * this.gameLevel);
          this.playerDamage(baseDamage);  //applys damage to player
          (this.hero.currentWeapon === "Bare fists") ? this.playSound('punch') : this.playSound('slice');
          this.playSound(monster.name);
          monster.health -= this.hero.atk;
            if (this.hero.health <= 0) {
                alert('You died.');
                this.resetGame();
                return false;
              }
            else if (monster.health <= 0) {
                this.hero.exp += monster.expGain;
                this.levelUp(oldLevel);
                return this.weaponDrop(tile);
              }
      }),

      weaponChooser: action(() => {
        let selectArr = weapons.filter((el) => {
          if (el.levelReq <= this.playerLevel){
              return (this.playerLevel >= 3) ? el.name !== this.hero.currentWeapon : true;
           }
           return false;
        });
        return selectArr[Math.floor(Math.random()*selectArr.length)];
      }),

      weaponDrop: action((tile) => {
        if (Math.random() * 100 < 40) {
          const obj = this.weaponChooser();
          this.grid[tile.y][tile.x] = { type: 'weapon', weapon: obj };
          return false;
        }
        return true;
      }),

      fightBoss: action(() => {
        this.fightMonster(this.boss);
        if (this.boss.health <= 0) {
          alert('You win');
          this.resetGame();
        }
      }),

      compiledCreation: action(() => {
        this.makeCurrentDungeon();
        this.syncStoreWithPos();
        (this.gameLevel === 1)
          ? this.placeBossRoom() : this.placePortal();

      }),
      resetGame: action(() => {
        this.playSound('Song');
        this.compiledCreation();
        this.hero = TheHero;
        this.gameLevel = 1;
      }),
      
      chosenKey: "",
      playerInput: "",
      percentWinStr: 0,
      percentWin: 0,
      pos1:0,
      pos2: 0,
      playerDamage: action((num) => {
        this.resetPos();
        this.choseKey();
        this.animateAndPlay(num);
      }),
      recievePlayerInput: action((keyCode) => this.playerInput = String.fromCharCode(keyCode)),
      animateAndPlay: action((num) => {
          const correct = this.chosenKey === this.playerInput;
          if (!correct && this.pos2 < 60) {
            this.pos1 = this.pos2;
            this.pos2++;
            crossTarget(this.pos1, this.pos2);
            setTimeout(() => {
              this.animateAndPlay(num);
            }, 20);
          } else if (correct) {
              confirmClick();
              this.getAccuracy(this.pos2);
              this.resetPos();
              this.hero.health -= Math.floor(num - (this.percentWin * num));
           } else if (this.pos2 === 60){
              hide();
              this.hero.health -= num;
          }

      }),

      getAccuracy: action((pos) => {
        let cent = (pos === 54 || pos === 44)
          ? 10
          : (pos > 54 || pos < 44)
          ? 0
          : 100 - ((Math.abs(49 - pos)) * 20);
          this.percentWin = cent / 100;
          this.percentWinStr = `${cent}% reduction!`;
      }),
      choseKey: action(() => this.chosenKey = arrOfKeys[Math.floor(Math.random() * 25)]),
      resetPos: action(() => {
        this.pos1 = 0;
        this.pos2 = 0;
      })
    })
  }
}

export default new MainStore();
