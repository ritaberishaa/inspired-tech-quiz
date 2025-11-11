import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { GameRoomComponent } from './components/game-room/game-room.component';
import { GameComponent } from './components/game/game.component';
import { ResultsComponent } from './components/results/results.component';
import { FirebaseGameService } from './services/firebase-game.service';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    GameRoomComponent,
    GameComponent,
    ResultsComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [FirebaseGameService],
  bootstrap: [AppComponent]
})
export class AppModule { }

